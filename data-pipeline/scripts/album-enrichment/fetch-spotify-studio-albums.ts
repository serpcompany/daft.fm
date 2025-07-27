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

async function fetchSpotifyStudioAlbums() {
  console.log('🎯 Fetching Studio Albums Only from Spotify\n');
  
  const db = new Database('spotify-studio-albums.db');
  
  // Create table
  db.exec(`
    CREATE TABLE IF NOT EXISTS studio_albums (
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
      is_studio_album BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Clear existing data
  db.prepare('DELETE FROM studio_albums').run();
  
  const token = await getSpotifyToken();
  
  const artists = [
    { name: 'The Beatles', id: '3WrFJ7ztbogyGnTHbHJFl2' },
    { name: 'Pink Floyd', id: '0k17h0D3J5VfsdmQ1iZtE9' },
    { name: 'David Bowie', id: '0oSGxfWSnnOXhD2fKuz2Gy' },
    { name: 'Led Zeppelin', id: '36QJpDe2go2KgaRleHCDTp' },
    { name: 'The Rolling Stones', id: '22bE4uQ6baNwSHPVcDxLCe' }
  ];
  
  // Lists of known compilations and live albums to filter out
  const knownCompilations = [
    'greatest hits', 'best of', 'collection', 'anthology', 'essential',
    'retrospective', '1962', '1967', 'forty licks', 'honk', 'mothership'
  ];
  
  const knownLiveAlbums = [
    'live', 'concert', 'tour', 'stage', 'unplugged', 'acoustic',
    'in concert', 'bootleg', '(live)', 'rooftop', 'bbc sessions'
  ];
  
  const stmt = db.prepare(`
    INSERT INTO studio_albums (
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
    
    // Filter and deduplicate albums
    const albumMap = new Map<string, any>();
    
    for (const album of data.items) {
      const lowerName = album.name.toLowerCase();
      
      // Skip live albums
      const isLive = knownLiveAlbums.some(term => lowerName.includes(term));
      if (isLive) continue;
      
      // Skip compilations
      const isCompilation = knownCompilations.some(term => lowerName.includes(term));
      if (isCompilation) continue;
      
      // Skip soundtracks
      if (lowerName.includes('soundtrack') || lowerName.includes('ost')) continue;
      
      // Clean album name (remove remastered, deluxe, etc.)
      const cleanName = album.name
        .replace(/ \(Remastered.*?\)/gi, '')
        .replace(/ \(.*?Deluxe.*?\)/gi, '')
        .replace(/ \(.*?Edition.*?\)/gi, '')
        .replace(/ \(.*?Anniversary.*?\)/gi, '')
        .replace(/ \(.*?Remaster.*?\)/gi, '')
        .replace(/ \(.*?Remix.*?\)/gi, '')
        .replace(/ \(.*?Mix.*?\)/gi, '')
        .replace(/ - Remastered.*/gi, '')
        .replace(/ \[.*?\]/g, '')
        .replace(/ \(Extras\)/gi, '')
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
    console.log(`After filtering out live/compilations: ${albumMap.size}`);
    console.log('\n📀 Studio Albums:');
    
    // Sort by release date
    const studioAlbums = Array.from(albumMap.values())
      .sort((a, b) => a.release_date.localeCompare(b.release_date));
    
    for (const album of studioAlbums) {
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
  
  // Beatles canonical check
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
    FROM studio_albums 
    WHERE artist_name = 'The Beatles'
    ORDER BY release_year
  `).all() as any[];
  
  const spotifyTitles = beatlesAlbums.map(a => a.album_name);
  
  console.log(`Expected canonical: ${canonicalBeatles.length}`);
  console.log(`Found studio albums: ${spotifyTitles.length}`);
  
  const missing = canonicalBeatles.filter(title => 
    !spotifyTitles.some(spotify => 
      spotify.toLowerCase() === title.toLowerCase()
    )
  );
  
  if (missing.length === 0) {
    console.log('\n✅ All canonical Beatles albums found!');
  } else {
    console.log('\n⚠️  Missing canonical albums:');
    missing.forEach(title => console.log(`  - ${title}`));
  }
  
  // Summary
  console.log('\n\n📊 STUDIO ALBUMS SUMMARY:');
  console.log('─'.repeat(60));
  
  const summary = db.prepare(`
    SELECT 
      artist_name,
      COUNT(*) as album_count,
      MIN(release_year) as first_year,
      MAX(release_year) as last_year
    FROM studio_albums
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
  console.log('\n✅ Data saved to spotify-studio-albums.db');
  
  // Now populate staging database
  console.log('\n\n🎯 Populating staging database with clean data...');
  
  const stagingDb = new Database('staging.db');
  const sourceDb = new Database('spotify-studio-albums.db');
  
  // Clear existing albums
  stagingDb.prepare('DELETE FROM albums').run();
  
  const albums = sourceDb.prepare(`
    SELECT * FROM studio_albums 
    ORDER BY artist_name, release_year
  `).all() as any[];
  
  const insertStmt = stagingDb.prepare(`
    INSERT INTO albums (
      title, slug, artist_id, 
      release_date, track_count,
      spotify_album_id, cover_art, 
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  
  // Get artist mappings
  const artistMap: Record<string, number> = {};
  const stagingArtists = stagingDb.prepare('SELECT id, name FROM artists').all() as any[];
  for (const artist of stagingArtists) {
    artistMap[artist.name] = artist.id;
  }
  
  let insertedCount = 0;
  const usedSlugs = new Set<string>();
  
  for (const album of albums) {
    const artistId = artistMap[album.artist_name];
    if (artistId) {
      // Create slug from album name and artist
      let baseSlug = `${album.artist_name}-${album.album_name}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Make sure slug is unique
      let slug = baseSlug;
      let counter = 1;
      while (usedSlugs.has(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      usedSlugs.add(slug);
      
      try {
        insertStmt.run(
          album.album_name,              // title
          slug,                          // slug
          artistId,                      // artist_id
          album.release_year,            // release_date (year only)
          album.total_tracks,            // track_count
          album.album_id,                // spotify_album_id
          album.image_url                // cover_art
        );
        insertedCount++;
      } catch (error: any) {
        console.error(`Failed to insert ${album.artist_name} - ${album.album_name}: ${error.message}`);
      }
    }
  }
  
  sourceDb.close();
  stagingDb.close();
  
  console.log(`\n✅ Inserted ${insertedCount} albums into staging database`);
}

fetchSpotifyStudioAlbums().catch(console.error);