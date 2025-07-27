#!/usr/bin/env tsx

import 'dotenv/config';
import { Client } from 'pg';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import Database from 'better-sqlite3';

const MB_CONNECTION = {
  host: process.env.MUSICBRAINZ_DB_HOST || 'localhost',
  port: parseInt(process.env.MUSICBRAINZ_DB_PORT || '5432'),
  database: process.env.MUSICBRAINZ_DB_NAME || 'musicbrainz_db',
  user: process.env.MUSICBRAINZ_DB_USER || 'musicbrainz',
  password: process.env.MUSICBRAINZ_DB_PASSWORD || ''
};

async function loadCanonicalMappings(): Promise<Map<string, string>> {
  console.log('📥 Loading canonical release mappings...');
  
  const canonicalMap = new Map<string, string>();
  
  return new Promise((resolve, reject) => {
    const parser = parse({
      columns: true,
      skip_empty_lines: true
    });
    
    parser.on('readable', function() {
      let record;
      while ((record = parser.read()) !== null) {
        // Map release_group_mbid to canonical_release_mbid
        if (record.release_group_mbid && record.canonical_release_mbid) {
          canonicalMap.set(record.release_group_mbid, record.canonical_release_mbid);
        }
      }
    });
    
    parser.on('end', () => {
      console.log(`✅ Loaded ${canonicalMap.size} canonical mappings\n`);
      resolve(canonicalMap);
    });
    
    parser.on('error', reject);
    
    createReadStream('musicbrainz-canonical-dump-20250717-080003/canonical/canonical_release_redirect.csv')
      .pipe(parser);
  });
}

async function queryBeatlesWithCanonical() {
  const pgClient = new Client(MB_CONNECTION);
  
  try {
    // First load canonical mappings
    const canonicalMap = await loadCanonicalMappings();
    
    await pgClient.connect();
    console.log('🎯 Querying Beatles Albums with Canonical Data\n');
    
    // Get all Beatles release groups (albums only, no secondary types)
    const query = `
      SELECT DISTINCT
        rg.gid AS release_group_mbid,
        rg.name AS album_title,
        rgm.first_release_date_year AS release_year,
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
      GROUP BY rg.id, rg.gid, rg.name, rgm.first_release_date_year, rgpt.name
      ORDER BY rgm.first_release_date_year, rg.name
    `;
    
    const result = await pgClient.query(query);
    
    // Filter using canonical data
    const canonicalAlbums = [];
    const nonCanonicalAlbums = [];
    
    for (const album of result.rows) {
      // Check if this release group has a canonical release
      if (canonicalMap.has(album.release_group_mbid)) {
        // Skip if it has secondary types (compilation, live, etc)
        const hasSecondaryTypes = album.secondary_types && 
          album.secondary_types.length > 0 && 
          album.secondary_types[0] !== null;
        
        if (!hasSecondaryTypes) {
          canonicalAlbums.push({
            ...album,
            canonical_release_mbid: canonicalMap.get(album.release_group_mbid)
          });
        }
      } else {
        nonCanonicalAlbums.push(album);
      }
    }
    
    console.log(`Total release groups: ${result.rows.length}`);
    console.log(`Canonical studio albums: ${canonicalAlbums.length}`);
    console.log(`Non-canonical/unofficial: ${nonCanonicalAlbums.length}\n`);
    
    console.log('📀 Canonical Beatles Studio Albums:');
    console.log('─'.repeat(60));
    
    for (const album of canonicalAlbums) {
      console.log(`${album.release_year || '????'} - ${album.album_title}`);
      console.log(`      Release Group: ${album.release_group_mbid}`);
      console.log(`      Canonical Release: ${album.canonical_release_mbid}`);
      console.log('');
    }
    
    // Compare with expected
    const expected = [
      'Please Please Me', 'With The Beatles', "A Hard Day's Night", 
      'Beatles For Sale', 'Help!', 'Rubber Soul', 'Revolver',
      "Sgt. Pepper's Lonely Hearts Club Band", 'Magical Mystery Tour',
      'The Beatles', 'Yellow Submarine', 'Abbey Road', 'Let It Be'
    ];
    
    const found = canonicalAlbums.map(a => a.album_title);
    
    console.log('\n📊 Comparison with Expected Discography:');
    console.log(`Expected: ${expected.length} albums`);
    console.log(`Found canonical: ${found.length} albums`);
    
    const matched = expected.filter(e => 
      found.some(f => f.toLowerCase() === e.toLowerCase())
    );
    console.log(`Matched: ${matched.length} albums`);
    
    const missing = expected.filter(e => 
      !found.some(f => f.toLowerCase() === e.toLowerCase())
    );
    
    if (missing.length > 0) {
      console.log(`\n⚠️  Missing:`);
      missing.forEach(album => console.log(`  - ${album}`));
    }
    
    // Compare with Spotify
    console.log('\n\n📊 Final Comparison:');
    console.log('─'.repeat(60));
    
    const stagingDb = new Database('staging.db');
    const spotifyAlbums = stagingDb.prepare(`
      SELECT COUNT(*) as count 
      FROM albums 
      WHERE artist_id = (SELECT id FROM artists WHERE name = 'The Beatles')
    `).get() as any;
    
    console.log(`Spotify (our current approach): ${spotifyAlbums.count} albums`);
    console.log(`MusicBrainz with canonical data: ${canonicalAlbums.length} albums`);
    console.log(`MusicBrainz without canonical: ${result.rows.length} albums`);
    
    stagingDb.close();
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pgClient.end();
  }
}

queryBeatlesWithCanonical().catch(console.error);