#!/usr/bin/env tsx

import 'dotenv/config';
import Database from 'better-sqlite3';
import { Client } from 'pg';

// Connection to MusicBrainz PostgreSQL
const MB_CONNECTION = {
  host: process.env.MUSICBRAINZ_DB_HOST || 'localhost',
  port: parseInt(process.env.MUSICBRAINZ_DB_PORT || '5432'),
  database: process.env.MUSICBRAINZ_DB_NAME || 'musicbrainz_db',
  user: process.env.MUSICBRAINZ_DB_USER || 'musicbrainz',
  password: process.env.MUSICBRAINZ_DB_PASSWORD || ''
};

console.log('MusicBrainz connection config:', {
  ...MB_CONNECTION,
  password: '***' // Hide password in logs
});

async function queryMusicBrainzCanonical() {
  console.log('🎯 Querying MusicBrainz Database for Canonical Albums\n');
  
  // First get artist MBIDs from our staging database
  const stagingDb = new Database('staging.db');
  
  const artists = stagingDb.prepare(`
    SELECT DISTINCT a.id, a.name, a.musicbrainz_id 
    FROM artists a
    JOIN albums al ON a.id = al.artist_id
    WHERE a.musicbrainz_id IS NOT NULL
    LIMIT 5
  `).all() as any[];
  
  if (artists.length === 0) {
    console.log('No artists with MusicBrainz IDs found');
    return;
  }
  
  // Connect to MusicBrainz PostgreSQL
  const pgClient = new Client(MB_CONNECTION);
  
  try {
    await pgClient.connect();
    console.log('✅ Connected to MusicBrainz database\n');
    
    // Build artist MBID list for query
    const artistMbids = artists.map(a => `'${a.musicbrainz_id}'`).join(', ');
    
    // Query for canonical albums
    const query = `
      WITH artist_release_groups AS (
        SELECT DISTINCT
          a.gid AS artist_mbid,
          a.name AS artist_name,
          rg.gid AS release_group_mbid,
          rg.name AS release_group_name,
          rg.type AS release_group_type,
          rgpt.name AS primary_type,
          string_agg(DISTINCT rgst.name, ', ') AS secondary_types
        FROM artist a
        JOIN artist_credit_name acn ON acn.artist = a.id
        JOIN artist_credit ac ON ac.id = acn.artist_credit
        JOIN release_group rg ON rg.artist_credit = ac.id
        LEFT JOIN release_group_primary_type rgpt ON rg.type = rgpt.id
        LEFT JOIN release_group_secondary_type_join rgstj ON rgstj.release_group = rg.id
        LEFT JOIN release_group_secondary_type rgst ON rgst.id = rgstj.secondary_type
        WHERE 
          a.gid IN (${artistMbids})
          AND rg.type = 1  -- albums only
        GROUP BY a.gid, a.name, rg.gid, rg.name, rg.type, rgpt.name
      ),
      canonical_releases AS (
        SELECT DISTINCT ON (arg.release_group_mbid)
          arg.release_group_mbid,
          r.gid AS release_mbid,
          r.name AS release_name,
          date_created.year AS release_year,
          rs.name AS release_status,
          c.name AS country,
          COUNT(m.id) AS medium_count,
          SUM(m.track_count) AS total_tracks
        FROM artist_release_groups arg
        JOIN release_group rg ON rg.gid = arg.release_group_mbid
        JOIN release r ON r.release_group = rg.id
        LEFT JOIN release_status rs ON r.status = rs.id
        LEFT JOIN release_country rc ON rc.release = r.id
        LEFT JOIN country c ON rc.country = c.id
        LEFT JOIN medium m ON m.release = r.id
        LEFT JOIN LATERAL (
          SELECT 
            EXTRACT(YEAR FROM TO_DATE(
              CONCAT(
                COALESCE(date_year::text, '1900'), '-',
                COALESCE(date_month::text, '01'), '-',
                COALESCE(date_day::text, '01')
              ), 'YYYY-MM-DD'
            ))::int AS year
          FROM release_country
          WHERE release = r.id
          LIMIT 1
        ) date_created ON true
        WHERE 
          (r.status = 1 OR r.status IS NULL)  -- Official releases only
        GROUP BY 
          arg.release_group_mbid, r.gid, r.name, date_created.year, rs.name, c.name
        ORDER BY 
          arg.release_group_mbid,
          CASE WHEN r.status = 1 THEN 0 ELSE 1 END,
          date_created.year NULLS LAST,
          CASE 
            WHEN c.iso_code = 'GB' THEN 1
            WHEN c.iso_code = 'US' THEN 2
            WHEN c.iso_code = 'XE' THEN 3
            ELSE 4
          END,
          total_tracks DESC
      )
      SELECT 
        arg.artist_name,
        arg.artist_mbid,
        arg.release_group_name AS album_title,
        arg.release_group_mbid,
        cr.release_mbid AS canonical_release_mbid,
        cr.release_year,
        cr.country,
        cr.total_tracks,
        arg.secondary_types
      FROM artist_release_groups arg
      LEFT JOIN canonical_releases cr ON cr.release_group_mbid = arg.release_group_mbid
      WHERE 
        (arg.secondary_types IS NULL 
         OR NOT (
           arg.secondary_types LIKE '%Compilation%' 
           OR arg.secondary_types LIKE '%Live%'
           OR arg.secondary_types LIKE '%Soundtrack%'
         ))
      ORDER BY 
        arg.artist_name,
        cr.release_year,
        arg.release_group_name
    `;
    
    console.log('Executing query...\n');
    const result = await pgClient.query(query);
    
    // Group results by artist
    const albumsByArtist = new Map<string, any[]>();
    
    for (const row of result.rows) {
      if (!albumsByArtist.has(row.artist_name)) {
        albumsByArtist.set(row.artist_name, []);
      }
      albumsByArtist.get(row.artist_name)!.push(row);
    }
    
    // Compare with Spotify data
    for (const [artistName, mbAlbums] of albumsByArtist) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🎤 ${artistName}`);
      console.log('='.repeat(80));
      
      const artist = artists.find(a => a.name === artistName);
      if (!artist) continue;
      
      // Get Spotify albums from staging
      const spotifyAlbums = stagingDb.prepare(`
        SELECT title, release_date, spotify_album_id 
        FROM albums 
        WHERE artist_id = ?
        ORDER BY release_date
      `).all(artist.id) as any[];
      
      console.log(`\n📊 Comparison:`);
      console.log(`MusicBrainz canonical albums: ${mbAlbums.length}`);
      console.log(`Spotify albums in DB: ${spotifyAlbums.length}`);
      
      // Show albums
      console.log(`\n${'MusicBrainz Canonical'.padEnd(40)} | ${'Spotify (in our DB)'.padEnd(40)}`);
      console.log(`${'-'.repeat(40)} | ${'-'.repeat(40)}`);
      
      const maxShow = Math.max(mbAlbums.length, spotifyAlbums.length);
      for (let i = 0; i < maxShow; i++) {
        let mbText = '';
        let spotifyText = '';
        
        if (i < mbAlbums.length) {
          const mb = mbAlbums[i];
          mbText = `${mb.release_year || '????'} - ${mb.album_title.substring(0, 30)}`;
        }
        
        if (i < spotifyAlbums.length) {
          const sp = spotifyAlbums[i];
          spotifyText = `${sp.release_date || '????'} - ${sp.title.substring(0, 30)}`;
        }
        
        console.log(`${mbText.padEnd(40)} | ${spotifyText.padEnd(40)}`);
      }
      
      // Analysis
      const normalizeTitle = (title: string) => 
        title.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      const mbTitles = new Set(mbAlbums.map(a => normalizeTitle(a.album_title)));
      const spotifyTitles = new Set(spotifyAlbums.map(a => normalizeTitle(a.title)));
      
      const matched = [...mbTitles].filter(t => spotifyTitles.has(t)).length;
      const onlyMb = mbTitles.size - matched;
      const onlySpotify = spotifyTitles.size - matched;
      
      console.log(`\n📈 Analysis:`);
      console.log(`Matched: ${matched} albums`);
      console.log(`Only in MB: ${onlyMb}`);
      console.log(`Only in Spotify: ${onlySpotify}`);
    }
    
  } catch (error) {
    console.error('Error querying MusicBrainz:', error);
  } finally {
    await pgClient.end();
    stagingDb.close();
  }
}

// Alternative: Simple query to test connection
async function testMusicBrainzConnection() {
  const pgClient = new Client(MB_CONNECTION);
  
  try {
    await pgClient.connect();
    console.log('Testing MusicBrainz connection...\n');
    
    // Simple query to check if we can connect
    const result = await pgClient.query(`
      SELECT COUNT(*) as release_group_count 
      FROM release_group 
      WHERE type = 1  -- albums
    `);
    
    console.log(`✅ Connected! Found ${result.rows[0].release_group_count} album release groups`);
    
    // Test canonical approach with Beatles
    const beatlesResult = await pgClient.query(`
      SELECT 
        rg.name AS album_title,
        rg.gid AS release_group_mbid,
        COUNT(DISTINCT r.id) AS release_count,
        MIN(rgm.first_release_date_year) as first_year
      FROM artist a
      JOIN artist_credit_name acn ON acn.artist = a.id
      JOIN artist_credit ac ON ac.id = acn.artist_credit
      JOIN release_group rg ON rg.artist_credit = ac.id
      JOIN release r ON r.release_group = rg.id
      LEFT JOIN release_group_meta rgm ON rgm.id = rg.id
      WHERE 
        a.gid = 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d'  -- The Beatles
        AND rg.type = 1  -- albums
      GROUP BY rg.id, rg.name, rg.gid
      ORDER BY MIN(rgm.first_release_date_year)
      LIMIT 20
    `);
    
    console.log('\n📀 Beatles Albums (first 20):');
    for (const row of beatlesResult.rows) {
      console.log(`- ${row.album_title} (${row.release_count} releases)`);
    }
    
  } catch (error) {
    console.error('Connection error:', error);
    console.log('\nMake sure to set these environment variables:');
    console.log('- MUSICBRAINZ_DB_HOST');
    console.log('- MUSICBRAINZ_DB_PORT'); 
    console.log('- MUSICBRAINZ_DB_NAME');
    console.log('- MUSICBRAINZ_DB_USER');
    console.log('- MUSICBRAINZ_DB_PASSWORD');
  } finally {
    await pgClient.end();
  }
}

// Run based on command line argument
const mode = process.argv[2];

if (mode === 'test') {
  testMusicBrainzConnection().catch(console.error);
} else {
  queryMusicBrainzCanonical().catch(console.error);
}

// Usage:
// npx tsx scripts/album-enrichment/query-musicbrainz-canonical.ts       # Full comparison
// npx tsx scripts/album-enrichment/query-musicbrainz-canonical.ts test  # Test connection