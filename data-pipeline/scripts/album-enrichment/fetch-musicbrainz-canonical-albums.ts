#!/usr/bin/env tsx

import 'dotenv/config';
import Database from 'better-sqlite3';
import { parse } from 'csv-parse';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';

async function downloadCanonicalData() {
  console.log('📥 Downloading MusicBrainz canonical release mapping...\n');
  
  // Download canonical release mapping
  const url = 'https://data.metabrainz.org/pub/musicbrainz/canonical_data/canonical_release_redirect.csv.gz';
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }
  
  // Save to temp file
  const buffer = await response.arrayBuffer();
  const fs = await import('fs');
  fs.writeFileSync('canonical_release_redirect.csv.gz', Buffer.from(buffer));
  
  console.log('✅ Downloaded canonical release mapping');
  return 'canonical_release_redirect.csv.gz';
}

async function processCanonicalData(filename: string) {
  console.log('\n📊 Processing canonical release data...\n');
  
  const db = new Database('musicbrainz-canonical.db');
  
  // Create table
  db.exec(`
    CREATE TABLE IF NOT EXISTS canonical_releases (
      release_group_mbid TEXT PRIMARY KEY,
      canonical_release_mbid TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Clear existing data
  db.prepare('DELETE FROM canonical_releases').run();
  
  const stmt = db.prepare(`
    INSERT INTO canonical_releases (release_group_mbid, canonical_release_mbid)
    VALUES (?, ?)
  `);
  
  let count = 0;
  const parser = parse({
    columns: true,
    skip_empty_lines: true
  });
  
  parser.on('readable', function() {
    let record;
    while ((record = parser.read()) !== null) {
      stmt.run(record.release_group_mbid, record.canonical_release_mbid);
      count++;
      if (count % 10000 === 0) {
        console.log(`Processed ${count.toLocaleString()} release mappings...`);
      }
    }
  });
  
  await pipeline(
    createReadStream(filename),
    createGunzip(),
    parser
  );
  
  console.log(`\n✅ Imported ${count.toLocaleString()} canonical release mappings`);
  
  // Clean up
  const fs = await import('fs');
  fs.unlinkSync(filename);
  
  return db;
}

async function fetchCanonicalAlbumsForArtists() {
  console.log('\n🎯 Fetching Canonical Albums from MusicBrainz\n');
  
  // First, download and process canonical data
  const filename = await downloadCanonicalData();
  const canonicalDb = await processCanonicalData(filename);
  
  // Now fetch albums for our artists
  const stagingDb = new Database('staging.db');
  
  const artists = stagingDb.prepare(`
    SELECT id, name, musicbrainz_artist_id 
    FROM artists 
    WHERE musicbrainz_artist_id IS NOT NULL
    LIMIT 10
  `).all() as any[];
  
  console.log(`\nFetching albums for ${artists.length} artists...\n`);
  
  for (const artist of artists) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎤 ${artist.name}`);
    console.log('='.repeat(60));
    
    // Fetch release groups for artist
    const releaseGroupsUrl = `https://musicbrainz.org/ws/2/release-group?artist=${artist.musicbrainz_artist_id}&type=album&fmt=json`;
    
    const response = await fetch(releaseGroupsUrl, {
      headers: {
        'User-Agent': 'DaftFmDataPipeline/1.0 (https://daft.fm)'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch release groups: ${response.statusText}`);
      continue;
    }
    
    const data = await response.json();
    const releaseGroups = data['release-groups'] || [];
    
    console.log(`Found ${releaseGroups.length} release groups`);
    
    // For each release group, find canonical release
    const canonicalAlbums = [];
    
    for (const rg of releaseGroups) {
      const canonical = canonicalDb.prepare(`
        SELECT canonical_release_mbid 
        FROM canonical_releases 
        WHERE release_group_mbid = ?
      `).get(rg.id) as any;
      
      if (canonical) {
        canonicalAlbums.push({
          release_group_id: rg.id,
          release_group_title: rg.title,
          canonical_release_id: canonical.canonical_release_mbid,
          first_release_date: rg['first-release-date']
        });
      } else {
        // If no canonical mapping, use first release
        console.log(`  ⚠️  No canonical mapping for "${rg.title}"`);
      }
    }
    
    console.log(`\n📀 Canonical Albums (${canonicalAlbums.length}):`);
    
    for (const album of canonicalAlbums.sort((a, b) => 
      (a.first_release_date || '').localeCompare(b.first_release_date || '')
    )) {
      console.log(`  ${album.first_release_date || '????'} - ${album.release_group_title}`);
      console.log(`       Release Group: ${album.release_group_id}`);
      console.log(`       Canonical Release: ${album.canonical_release_id}`);
    }
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  canonicalDb.close();
  stagingDb.close();
  
  console.log('\n✅ Canonical album exploration complete');
}

// Alternative: Direct API approach without downloading full dataset
async function fetchCanonicalAlbumsDirectly() {
  console.log('\n🎯 Fetching Canonical Albums via MusicBrainz API\n');
  
  const db = new Database('staging.db');
  
  const artists = db.prepare(`
    SELECT id, name, musicbrainz_artist_id 
    FROM artists 
    WHERE musicbrainz_artist_id IS NOT NULL
    LIMIT 5
  `).all() as any[];
  
  for (const artist of artists) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎤 ${artist.name}`);
    console.log('='.repeat(60));
    
    // Fetch release groups with releases included
    const url = `https://musicbrainz.org/ws/2/release-group?artist=${artist.musicbrainz_artist_id}&type=album&inc=releases&fmt=json`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DaftFmDataPipeline/1.0 (https://daft.fm)'
      }
    });
    
    const data = await response.json();
    const releaseGroups = data['release-groups'] || [];
    
    console.log(`\n📀 Studio Albums (${releaseGroups.length}):`);
    
    for (const rg of releaseGroups.sort((a: any, b: any) => 
      (a['first-release-date'] || '').localeCompare(b['first-release-date'] || '')
    )) {
      // Pick the "best" release from the group
      // Criteria: Official status, earliest date, most countries
      const releases = rg.releases || [];
      
      const bestRelease = releases
        .filter((r: any) => r.status === 'Official')
        .sort((a: any, b: any) => {
          // Sort by date, then by country count
          const dateCompare = (a.date || '').localeCompare(b.date || '');
          if (dateCompare !== 0) return dateCompare;
          return (b['release-events']?.length || 0) - (a['release-events']?.length || 0);
        })[0];
      
      if (bestRelease) {
        console.log(`\n${rg['first-release-date'] || '????'} - ${rg.title}`);
        console.log(`  Release Group: ${rg.id}`);
        console.log(`  Best Release: ${bestRelease.id}`);
        console.log(`  Status: ${bestRelease.status}`);
        console.log(`  Countries: ${bestRelease['release-events']?.length || 0}`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  db.close();
}

// Uncomment the approach you want to test:

// Approach 1: Download and use canonical dataset (recommended for production)
// fetchCanonicalAlbumsForArtists().catch(console.error);

// Approach 2: Use API directly with our own "best release" logic
fetchCanonicalAlbumsDirectly().catch(console.error);