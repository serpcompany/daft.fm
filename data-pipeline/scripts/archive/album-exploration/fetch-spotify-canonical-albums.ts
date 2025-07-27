#!/usr/bin/env tsx

import 'dotenv/config';
import Database from 'better-sqlite3';

async function getSpotifyToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });
  
  const data = await response.json();
  return data.access_token;
}

async function fetchSpotifyCanonicalAlbums() {
  console.log('🎯 Fetching Canonical Albums from Spotify\n');
  
  const db = new Database('spotify-canonical-albums.db');
  
  // Create table
  db.exec(`
    CREATE TABLE IF NOT EXISTS canonical_albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist_name TEXT NOT NULL,
      artist_id TEXT NOT NULL,
      album_name TEXT NOT NULL,
      album_id TEXT NOT NULL,
      release_date TEXT NOT NULL,
      release_year INTEGER,
      total_tracks INTEGER,
      album_type TEXT,
      spotify_url TEXT,
      image_url TEXT,
      is_canonical BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Clear existing data
  db.prepare('DELETE FROM canonical_albums').run();
  
  const token = await getSpotifyToken();
  
  const artists = [
    { name: 'The Beatles', id: '3WrFJ7ztbogyGnTHbHJFl2' },
    { name: 'Pink Floyd', id: '0k17h0D3J5VfsdmQ1iZtE9' },
    { name: 'David Bowie', id: '0oSGxfWSnnOXhD2fKuz2Gy' },
    { name: 'Led Zeppelin', id: '36QJpDe2go2KgaRleHCDTp' },
    { name: 'The Rolling Stones', id: '22bE4uQ6baNwSHPVcDxLCe' }
  ];
  
  const stmt = db.prepare(`
    INSERT INTO canonical_albums (
      artist_name, artist_id, album_name, album_id,
      release_date, release_year, total_tracks, album_type,
      spotify_url, image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const artist of artists) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎤 ${artist.name}`);
    console.log('='.repeat(60));
    
    // Fetch albums with include_groups=album filter
    const url = `https://api.spotify.com/v1/artists/${artist.id}/albums?include_groups=album&limit=50&market=US`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    // Deduplicate albums by base name
    const albumMap = new Map<string, any>();
    
    for (const album of data.items) {
      // Clean album name (remove remastered, deluxe, etc.)
      const cleanName = album.name
        .replace(/ \(Remastered.*?\)/gi, '')
        .replace(/ \(.*?Deluxe.*?\)/gi, '')
        .replace(/ \(.*?Edition.*?\)/gi, '')
        .replace(/ \(.*?Anniversary.*?\)/gi, '')
        .replace(/ \(.*?Remaster.*?\)/gi, '')
        .replace(/ - Remastered/gi, '')
        .replace(/ \[.*?\]/g, '')
        .trim();
      
      // Keep the earliest release of each album
      if (!albumMap.has(cleanName) || 
          album.release_date < albumMap.get(cleanName).release_date) {
        albumMap.set(cleanName, {
          ...album,
          cleanName
        });
      }
    }
    
    console.log(`\nTotal albums from Spotify: ${data.items.length}`);
    console.log(`After deduplication: ${albumMap.size}`);
    console.log('\n📀 Canonical Albums:');
    
    // Sort by release date
    const canonicalAlbums = Array.from(albumMap.values())
      .sort((a, b) => a.release_date.localeCompare(b.release_date));
    
    for (const album of canonicalAlbums) {
      const year = parseInt(album.release_date.substring(0, 4));
      console.log(`  ${year} - ${album.cleanName}`);
      
      stmt.run(
        artist.name,
        artist.id,
        album.cleanName,
        album.id,
        album.release_date,
        year,
        album.total_tracks,
        album.album_type,
        album.external_urls.spotify,
        album.images[0]?.url || null
      );
    }
  }
  
  // Show Beatles canonical check
  console.log('\n\n📊 BEATLES CANONICAL CHECK:');
  console.log('─'.repeat(60));
  
  const canonicalBeatles = [
    'Please Please Me', 'With The Beatles', "A Hard Day's Night", 
    'Beatles For Sale', 'Help!', 'Rubber Soul', 'Revolver',
    "Sgt. Pepper's Lonely Hearts Club Band", 'Magical Mystery Tour',
    'The Beatles', 'Yellow Submarine', 'Abbey Road', 'Let It Be'
  ];
  
  const beatlesAlbums = db.prepare(`
    SELECT album_name, release_year 
    FROM canonical_albums 
    WHERE artist_name = 'The Beatles'
    ORDER BY release_year
  `).all() as any[];
  
  const spotifyTitles = beatlesAlbums.map(a => a.album_name);
  
  console.log(`Expected canonical: ${canonicalBeatles.length}`);
  console.log(`Found in Spotify: ${spotifyTitles.length}`);
  
  const missing = canonicalBeatles.filter(title => 
    !spotifyTitles.some(spotify => 
      spotify.toLowerCase() === title.toLowerCase()
    )
  );
  
  if (missing.length > 0) {
    console.log('\n⚠️  Missing canonical albums:');
    missing.forEach(title => console.log(`  - ${title}`));
  }
  
  const extra = spotifyTitles.filter(spotify => 
    !canonicalBeatles.some(canon => 
      spotify.toLowerCase() === canon.toLowerCase()
    )
  );
  
  if (extra.length > 0) {
    console.log('\n⚠️  Extra non-canonical albums:');
    extra.forEach(title => console.log(`  - ${title}`));
  }
  
  // Summary statistics
  console.log('\n\n📊 SUMMARY:');
  console.log('─'.repeat(60));
  
  const summary = db.prepare(`
    SELECT 
      artist_name,
      COUNT(*) as album_count,
      MIN(release_year) as first_year,
      MAX(release_year) as last_year
    FROM canonical_albums
    GROUP BY artist_name
    ORDER BY artist_name
  `).all();
  
  console.log('Artist              | Albums | Period');
  console.log('--------------------|--------|-------------');
  
  for (const row of summary as any[]) {
    console.log(
      `${row.artist_name.padEnd(19)} | ${String(row.album_count).padStart(6)} | ${row.first_year}-${row.last_year}`
    );
  }
  
  db.close();
  console.log('\n✅ Data saved to spotify-canonical-albums.db');
  console.log('\nTo view in Drizzle Studio, create a config file and run:');
  console.log('npx drizzle-kit studio --config ./drizzle-spotify.config.ts');
}

fetchSpotifyCanonicalAlbums().catch(console.error);