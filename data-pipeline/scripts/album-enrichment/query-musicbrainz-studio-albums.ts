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

async function queryCanonicalStudioAlbums() {
  const pgClient = new Client(MB_CONNECTION);
  
  try {
    await pgClient.connect();
    console.log('🎯 Querying MusicBrainz for Canonical Studio Albums\n');
    
    // Get Beatles studio albums only
    const query = `
      WITH studio_albums AS (
        SELECT DISTINCT
          rg.gid AS release_group_mbid,
          rg.name AS album_title,
          rgm.first_release_date_year AS release_year,
          rg.type,
          rgpt.name AS primary_type,
          array_agg(DISTINCT rgst.name) AS secondary_types
        FROM artist a
        JOIN artist_credit_name acn ON acn.artist = a.id
        JOIN artist_credit ac ON ac.id = acn.artist_credit
        JOIN release_group rg ON rg.artist_credit = ac.id
        LEFT JOIN release_group_meta rgm ON rgm.id = rg.id
        LEFT JOIN release_group_primary_type rgpt ON rg.type = rgpt.id
        LEFT JOIN release_group_secondary_type_join rgstj ON rgstj.release_group = rg.id
        LEFT JOIN release_group_secondary_type rgst ON rgst.id = rgstj.secondary_type
        WHERE 
          a.gid = 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d'  -- The Beatles
          AND rg.type = 1  -- albums only
        GROUP BY rg.id, rg.gid, rg.name, rgm.first_release_date_year, rg.type, rgpt.name
      ),
      filtered_albums AS (
        SELECT *
        FROM studio_albums
        WHERE 
          -- Exclude compilations, live albums, soundtracks
          (secondary_types IS NULL OR NOT (
            'Compilation' = ANY(secondary_types) OR
            'Live' = ANY(secondary_types) OR
            'Soundtrack' = ANY(secondary_types) OR
            'Interview' = ANY(secondary_types) OR
            'Audiobook' = ANY(secondary_types) OR
            'Spokenword' = ANY(secondary_types) OR
            'Remix' = ANY(secondary_types) OR
            'DJ-mix' = ANY(secondary_types) OR
            'Mixtape/Street' = ANY(secondary_types)
          ))
      ),
      canonical_releases AS (
        SELECT DISTINCT ON (fa.release_group_mbid)
          fa.*,
          r.gid AS canonical_release_mbid,
          r.name AS release_name,
          rc.date_year AS release_date_year,
          c.name AS country,
          rs.name AS status,
          COUNT(m.id) OVER (PARTITION BY r.id) AS medium_count,
          SUM(m.track_count) OVER (PARTITION BY r.id) AS total_tracks
        FROM filtered_albums fa
        JOIN release_group rg ON rg.gid = fa.release_group_mbid
        JOIN release r ON r.release_group = rg.id
        LEFT JOIN release_country rc ON rc.release = r.id
        LEFT JOIN country c ON rc.country = c.id
        LEFT JOIN release_status rs ON r.status = rs.id
        LEFT JOIN medium m ON m.release = r.id
        WHERE 
          (r.status = 1 OR r.status IS NULL)  -- Official releases only
        ORDER BY 
          fa.release_group_mbid,
          CASE WHEN r.status = 1 THEN 0 ELSE 1 END,  -- Official first
          rc.date_year,  -- Earliest release
          CASE 
            WHEN c.iso_code = 'GB' THEN 1  -- UK first for UK bands
            WHEN c.iso_code = 'US' THEN 2
            WHEN c.iso_code = 'XE' THEN 3  -- Europe
            ELSE 4
          END
      )
      SELECT 
        album_title,
        release_year,
        secondary_types,
        country,
        total_tracks,
        release_group_mbid,
        canonical_release_mbid
      FROM canonical_releases
      ORDER BY release_year, album_title
    `;
    
    const result = await pgClient.query(query);
    
    console.log(`Found ${result.rows.length} Beatles studio albums:\n`);
    
    for (const album of result.rows) {
      console.log(`${album.release_year || '????'} - ${album.album_title}`);
      console.log(`      Country: ${album.country || 'Unknown'}`);
      console.log(`      Tracks: ${album.total_tracks || 'Unknown'}`);
      if (album.secondary_types && album.secondary_types.length > 0 && album.secondary_types[0] !== null) {
        console.log(`      Types: ${album.secondary_types.filter(t => t).join(', ')}`);
      }
      console.log(`      Release Group: ${album.release_group_mbid}`);
      console.log('');
    }
    
    // Compare with our expected canonical list
    const expected = [
      'Please Please Me', 'With The Beatles', "A Hard Day's Night", 
      'Beatles For Sale', 'Help!', 'Rubber Soul', 'Revolver',
      "Sgt. Pepper's Lonely Hearts Club Band", 'Magical Mystery Tour',
      'The Beatles', 'Yellow Submarine', 'Abbey Road', 'Let It Be'
    ];
    
    const found = result.rows.map(r => r.album_title);
    const missing = expected.filter(e => !found.some(f => f.toLowerCase() === e.toLowerCase()));
    const extra = found.filter(f => !expected.some(e => e.toLowerCase() === f.toLowerCase()));
    
    console.log('\n📊 Comparison with expected canonical albums:');
    console.log(`Expected: ${expected.length}`);
    console.log(`Found: ${found.length}`);
    
    if (missing.length > 0) {
      console.log(`\n⚠️  Missing: ${missing.join(', ')}`);
    }
    
    if (extra.length > 0) {
      console.log(`\n⚠️  Extra: ${extra.join(', ')}`);
    }
    
    // Now compare with our staging DB
    console.log('\n\n📊 Comparing with Spotify data in staging DB:');
    
    const stagingDb = new Database('staging.db');
    const spotifyAlbums = stagingDb.prepare(`
      SELECT title, release_date 
      FROM albums 
      WHERE artist_id = (SELECT id FROM artists WHERE name = 'The Beatles')
      ORDER BY release_date
    `).all() as any[];
    
    console.log(`\nSpotify albums in DB: ${spotifyAlbums.length}`);
    console.log(`MusicBrainz studio albums: ${result.rows.length}`);
    
    stagingDb.close();
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pgClient.end();
  }
}

queryCanonicalStudioAlbums().catch(console.error);