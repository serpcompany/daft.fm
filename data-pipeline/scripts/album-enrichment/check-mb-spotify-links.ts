#!/usr/bin/env tsx

import 'dotenv/config';
import { Client } from 'pg';

const MB_CONNECTION = {
  host: process.env.MUSICBRAINZ_DB_HOST || 'localhost',
  port: parseInt(process.env.MUSICBRAINZ_DB_PORT || '5432'),
  database: process.env.MUSICBRAINZ_DB_NAME || 'musicbrainz_db',
  user: process.env.MUSICBRAINZ_DB_USER || 'musicbrainz',
  password: process.env.MUSICBRAINZ_DB_PASSWORD || ''
};

async function checkSpotifyLinks() {
  const pgClient = new Client(MB_CONNECTION);
  
  try {
    await pgClient.connect();
    console.log('🔍 Checking MusicBrainz database for Spotify URLs\n');
    
    // Check how many releases have Spotify URLs
    const query = `
      SELECT COUNT(DISTINCT r.id) as release_count
      FROM release r
      JOIN l_release_url lru ON lru.entity0 = r.id
      JOIN url u ON u.id = lru.entity1
      WHERE u.url LIKE '%spotify.com%'
    `;
    
    const result = await pgClient.query(query);
    console.log(`Total releases with Spotify URLs: ${result.rows[0].release_count}`);
    
    // Get some examples
    const examples = await pgClient.query(`
      SELECT 
        r.gid as release_mbid,
        r.name as release_name,
        ac.name as artist_name,
        u.url as spotify_url,
        rg.gid as release_group_mbid
      FROM release r
      JOIN release_group rg ON r.release_group = rg.id
      JOIN artist_credit ac ON r.artist_credit = ac.id
      JOIN l_release_url lru ON lru.entity0 = r.id
      JOIN url u ON u.id = lru.entity1
      WHERE u.url LIKE '%spotify.com%'
      LIMIT 10
    `);
    
    console.log('\nExample releases with Spotify links:');
    for (const row of examples.rows) {
      console.log(`\n${row.artist_name} - ${row.release_name}`);
      console.log(`  Release MBID: ${row.release_mbid}`);
      console.log(`  Release Group MBID: ${row.release_group_mbid}`);
      console.log(`  Spotify URL: ${row.spotify_url}`);
    }
    
    // Check if we can build a mapping table
    console.log('\n\n📊 Checking coverage for our artists...');
    
    const coverageQuery = await pgClient.query(`
      WITH our_artists AS (
        SELECT DISTINCT a.gid, a.name
        FROM artist a
        WHERE a.name IN ('The Beatles', 'Pink Floyd', 'David Bowie', 'Led Zeppelin', 'The Rolling Stones')
      )
      SELECT 
        oa.name as artist_name,
        COUNT(DISTINCT r.id) as total_releases,
        COUNT(DISTINCT CASE WHEN u.url LIKE '%spotify.com%' THEN r.id END) as spotify_linked_releases
      FROM our_artists oa
      JOIN artist_credit_name acn ON acn.artist = (SELECT id FROM artist WHERE gid = oa.gid)
      JOIN artist_credit ac ON ac.id = acn.artist_credit
      JOIN release r ON r.artist_credit = ac.id
      LEFT JOIN l_release_url lru ON lru.entity0 = r.id
      LEFT JOIN url u ON u.id = lru.entity1 AND u.url LIKE '%spotify.com%'
      GROUP BY oa.name
      ORDER BY oa.name
    `);
    
    console.log('\nArtist            | Total Releases | With Spotify URL');
    console.log('------------------|----------------|------------------');
    for (const row of coverageQuery.rows) {
      const pct = row.total_releases > 0 
        ? ((row.spotify_linked_releases / row.total_releases) * 100).toFixed(1) 
        : '0.0';
      console.log(
        `${row.artist_name.padEnd(17)} | ${String(row.total_releases).padStart(14)} | ${String(row.spotify_linked_releases).padStart(16)} (${pct}%)`
      );
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pgClient.end();
  }
}

checkSpotifyLinks().catch(console.error);