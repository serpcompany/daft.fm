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

async function queryBeatlesAlbums() {
  const pgClient = new Client(MB_CONNECTION);
  
  try {
    await pgClient.connect();
    console.log('🎯 Querying Beatles Albums from MusicBrainz\n');
    
    // Simpler query - just get release groups without secondary types
    const query = `
      SELECT DISTINCT
        rg.gid AS release_group_mbid,
        rg.name AS album_title,
        rgm.first_release_date_year AS release_year,
        rgpt.name AS primary_type,
        COUNT(DISTINCT r.id) AS release_count
      FROM artist a
      JOIN artist_credit_name acn ON acn.artist = a.id
      JOIN artist_credit ac ON ac.id = acn.artist_credit
      JOIN release_group rg ON rg.artist_credit = ac.id
      LEFT JOIN release_group_meta rgm ON rgm.id = rg.id
      LEFT JOIN release_group_primary_type rgpt ON rg.type = rgpt.id
      LEFT JOIN release r ON r.release_group = rg.id
      WHERE 
        a.gid = 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d'  -- The Beatles
        AND rg.type = 1  -- albums only
        -- Exclude release groups that have secondary types (compilations, live, etc)
        AND NOT EXISTS (
          SELECT 1 
          FROM release_group_secondary_type_join rgstj
          WHERE rgstj.release_group = rg.id
        )
      GROUP BY rg.id, rg.gid, rg.name, rgm.first_release_date_year, rgpt.name
      ORDER BY rgm.first_release_date_year, rg.name
    `;
    
    const result = await pgClient.query(query);
    
    console.log(`Found ${result.rows.length} Beatles studio albums:\n`);
    
    const albums = result.rows;
    
    for (const album of albums) {
      console.log(`${album.release_year || '????'} - ${album.album_title}`);
      console.log(`      Releases: ${album.release_count}`);
      console.log(`      MBID: ${album.release_group_mbid}`);
      console.log('');
    }
    
    // Compare with expected
    const expected = [
      'Please Please Me', 'With The Beatles', "A Hard Day's Night", 
      'Beatles For Sale', 'Help!', 'Rubber Soul', 'Revolver',
      "Sgt. Pepper's Lonely Hearts Club Band", 'Magical Mystery Tour',
      'The Beatles', 'Yellow Submarine', 'Abbey Road', 'Let It Be'
    ];
    
    const found = albums.map(a => a.album_title);
    console.log('\n📊 Analysis:');
    console.log(`Expected canonical albums: ${expected.length}`);
    console.log(`Found in MusicBrainz: ${found.length}`);
    
    const matched = expected.filter(e => 
      found.some(f => f.toLowerCase().includes(e.toLowerCase()) || e.toLowerCase().includes(f.toLowerCase()))
    );
    
    console.log(`Matched: ${matched.length} albums`);
    
    // Show any that don't match
    const notFound = expected.filter(e => 
      !found.some(f => f.toLowerCase().includes(e.toLowerCase()) || e.toLowerCase().includes(f.toLowerCase()))
    );
    
    if (notFound.length > 0) {
      console.log(`\n⚠️  Not found in results:`);
      notFound.forEach(album => console.log(`  - ${album}`));
    }
    
    // Show extras
    const extras = found.filter(f => 
      !expected.some(e => f.toLowerCase().includes(e.toLowerCase()) || e.toLowerCase().includes(f.toLowerCase()))
    );
    
    if (extras.length > 0) {
      console.log(`\n⚠️  Extra albums found:`);
      extras.forEach(album => console.log(`  - ${album}`));
    }
    
    // Compare with Spotify
    console.log('\n\n📊 Comparing with Spotify data:');
    
    const stagingDb = new Database('staging.db');
    const spotifyAlbums = stagingDb.prepare(`
      SELECT title, release_date 
      FROM albums 
      WHERE artist_id = (SELECT id FROM artists WHERE name = 'The Beatles')
      ORDER BY release_date
    `).all() as any[];
    
    console.log(`Spotify albums in staging DB: ${spotifyAlbums.length}`);
    console.log(`MusicBrainz studio albums: ${albums.length}`);
    
    stagingDb.close();
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pgClient.end();
  }
}

queryBeatlesAlbums().catch(console.error);