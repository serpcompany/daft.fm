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

async function fetchSpotifyTracks() {
  console.log('🎵 Fetching Tracks from Spotify\n');
  
  const db = new Database('staging.db');
  
  // Get all albums with Spotify IDs
  const albums = db.prepare(`
    SELECT 
      a.id,
      a.title as album_title,
      a.spotify_album_id,
      a.artist_id,
      ar.name as artist_name
    FROM albums a
    JOIN artists ar ON a.artist_id = ar.id
    WHERE a.spotify_album_id IS NOT NULL
    ORDER BY ar.name, a.release_date
  `).all() as any[];
  
  console.log(`Found ${albums.length} albums to fetch tracks for\n`);
  
  const token = await getSpotifyToken();
  
  // Prepare insert statement
  const insertStmt = db.prepare(`
    INSERT INTO songs (
      title, slug, duration, track_number, disc_number,
      explicit, popularity, preview_url,
      artist_id, album_id, spotify_track_id, isrc,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  
  // Clear existing songs to avoid duplicates
  console.log('🧹 Clearing existing songs...');
  db.prepare('DELETE FROM songs').run();
  
  let totalTracks = 0;
  const usedSlugs = new Set<string>();
  
  for (const album of albums) {
    console.log(`\n📀 ${album.artist_name} - ${album.album_title}`);
    
    try {
      // Fetch album tracks from Spotify
      const url = `https://api.spotify.com/v1/albums/${album.spotify_album_id}/tracks?limit=50`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.log(`  ❌ Failed to fetch tracks: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`  → Found ${data.items.length} tracks`);
      
      for (const track of data.items) {
        // Create unique slug
        let baseSlug = `${album.artist_name}-${track.name}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        
        let slug = baseSlug;
        let counter = 1;
        while (usedSlugs.has(slug)) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
        usedSlugs.add(slug);
        
        // Get full track details (includes popularity)
        const trackDetailUrl = `https://api.spotify.com/v1/tracks/${track.id}`;
        const trackDetailResponse = await fetch(trackDetailUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        let popularity = null;
        if (trackDetailResponse.ok) {
          const trackDetail = await trackDetailResponse.json();
          popularity = trackDetail.popularity;
        }
        
        try {
          insertStmt.run(
            track.name,                            // title
            slug,                                  // slug
            Math.floor(track.duration_ms / 1000),  // duration (in seconds)
            track.track_number,                    // track_number
            track.disc_number,                     // disc_number
            track.explicit ? 1 : 0,                // explicit (as integer)
            popularity,                            // popularity
            track.preview_url,                     // preview_url
            album.artist_id,                       // artist_id
            album.id,                              // album_id
            track.id,                              // spotify_track_id
            track.external_ids?.isrc || null      // isrc
          );
          
          totalTracks++;
          
          // Log some details for first few tracks
          if (track.track_number <= 3) {
            console.log(`    ${track.track_number}. ${track.name}${track.explicit ? ' [E]' : ''} (${Math.floor(track.duration_ms / 1000)}s)`);
          }
        } catch (error: any) {
          console.log(`    ⚠️  Failed to insert track "${track.name}": ${error.message}`);
        }
      }
      
      // Be nice to Spotify's rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  db.close();
  
  console.log('\n\n✅ Track fetching complete!');
  console.log(`Total tracks inserted: ${totalTracks}`);
  
  // Show summary
  const summaryDb = new Database('staging.db');
  const summary = summaryDb.prepare(`
    SELECT 
      ar.name as artist,
      COUNT(DISTINCT a.id) as albums,
      COUNT(s.id) as tracks,
      AVG(s.popularity) as avg_popularity,
      SUM(CASE WHEN s.explicit = 1 THEN 1 ELSE 0 END) as explicit_tracks
    FROM artists ar
    LEFT JOIN albums a ON ar.id = a.artist_id
    LEFT JOIN songs s ON ar.id = s.artist_id
    GROUP BY ar.id, ar.name
    ORDER BY ar.name
  `).all() as any[];
  
  console.log('\n📊 Summary by Artist:');
  console.log('Artist              | Albums | Tracks | Avg Pop | Explicit');
  console.log('--------------------|--------|--------|---------|----------');
  
  for (const row of summary) {
    console.log(
      `${(row.artist || 'Unknown').substring(0, 19).padEnd(19)} | ` +
      `${String(row.albums).padStart(6)} | ` +
      `${String(row.tracks).padStart(6)} | ` +
      `${row.avg_popularity ? row.avg_popularity.toFixed(1).padStart(7) : '    N/A'} | ` +
      `${String(row.explicit_tracks).padStart(8)}`
    );
  }
  
  summaryDb.close();
}

fetchSpotifyTracks().catch(console.error);