#!/usr/bin/env tsx

import 'dotenv/config';
import Database from 'better-sqlite3';

async function fetchDiscogsMastersOnly() {
  console.log('🎯 Fetching Master Albums from Discogs Artist Releases\n');
  
  const db = new Database('discogs-masters.db');
  
  // Create table with rich schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS master_albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist_name TEXT NOT NULL,
      artist_id TEXT NOT NULL,
      title TEXT NOT NULL,
      year INTEGER,
      master_id INTEGER NOT NULL,
      format TEXT,
      label TEXT,
      country TEXT,
      thumb TEXT,
      resource_url TEXT,
      -- Rich data fields
      genres TEXT, -- JSON array
      styles TEXT, -- JSON array
      tracklist TEXT, -- JSON array
      images TEXT, -- JSON array
      duration_seconds INTEGER,
      track_count INTEGER,
      main_release_id INTEGER,
      main_release_country TEXT,
      versions_count INTEGER,
      lowest_price REAL,
      data_quality TEXT, -- JSON object
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Clear existing data
  db.prepare('DELETE FROM master_albums').run();
  
  const artists = [
    { name: 'The Beatles', id: '82730' },
    { name: 'Pink Floyd', id: '45467' },
    { name: 'David Bowie', id: '10263' }
  ];
  
  for (const artist of artists) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎤 Fetching masters for ${artist.name}`);
    console.log('='.repeat(60));
    
    try {
      let page = 1;
      let hasMore = true;
      let totalMasters = 0;
      let albumMasters = 0;
      
      const stmt = db.prepare(`
        INSERT INTO master_albums (
          artist_name, artist_id, title, year, master_id,
          format, label, country, thumb, resource_url,
          genres, styles, tracklist, images, duration_seconds,
          track_count, main_release_id, main_release_country, 
          versions_count, lowest_price, data_quality
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      while (hasMore) {
        // Fetch only masters, sorted by year
        const url = `https://api.discogs.com/artists/${artist.id}/releases?page=${page}&per_page=100&sort=year&sort_order=asc&type=master`;
        
        console.log(`Fetching page ${page}...`);
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
            'User-Agent': 'DaftFmDataPipeline/1.0'
          }
        });
        
        const data = await response.json();
        
        if (!data.releases || data.releases.length === 0) {
          hasMore = false;
          break;
        }
        
        // Process masters and fetch detailed data for albums
        for (const release of data.releases) {
          if (release.type !== 'master' || release.role !== 'Main') continue;
          
          totalMasters++;
          
          // Fetch master details to check format
          await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
          
          const masterResponse = await fetch(release.resource_url, {
            headers: {
              'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
              'User-Agent': 'DaftFmDataPipeline/1.0'
            }
          });
          
          const masterData = await masterResponse.json();
          
          // Check if it's an album based on format
          const isAlbum = masterData.formats?.some((f: any) => 
            f.name === 'Album' || 
            f.name === 'LP' || 
            (f.name === 'CD' && !f.descriptions?.includes('Single'))
          );
          
          if (!isAlbum) continue;
          
          albumMasters++;
          
          // Extract rich data
          const tracklist = masterData.tracklist || [];
          const trackCount = tracklist.filter((t: any) => t.type_ === 'track').length;
          
          let duration = 0;
          for (const track of tracklist) {
            if (track.duration) {
              const parts = track.duration.split(':');
              duration += parseInt(parts[0]) * 60 + parseInt(parts[1]);
            }
          }
          
          // Find main release country
          const mainRelease = masterData.main_release_url ? 
            await fetch(masterData.main_release_url, {
              headers: {
                'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
                'User-Agent': 'DaftFmDataPipeline/1.0'
              }
            }).then(r => r.json()) : null;
          
          await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
          
          // Data quality assessment
          const dataQuality = {
            has_tracklist: tracklist.length > 0,
            has_genres: (masterData.genres || []).length > 0,
            has_styles: (masterData.styles || []).length > 0,
            has_images: (masterData.images || []).length > 0,
            has_year: !!masterData.year,
            has_country: !!mainRelease?.country,
            completeness_score: 0
          };
          
          dataQuality.completeness_score = Object.values(dataQuality)
            .filter(v => v === true).length / 6;
          
          stmt.run(
            artist.name,
            artist.id,
            masterData.title,
            masterData.year || null,
            release.id,
            masterData.formats?.map((f: any) => f.name).join(', ') || null,
            release.label || null,
            mainRelease?.country || null,
            release.thumb || null,
            release.resource_url,
            JSON.stringify(masterData.genres || []),
            JSON.stringify(masterData.styles || []),
            JSON.stringify(tracklist.map((t: any) => ({
              position: t.position,
              title: t.title,
              duration: t.duration
            }))),
            JSON.stringify(masterData.images?.map((img: any) => ({
              type: img.type,
              uri: img.uri,
              uri150: img.uri150,
              width: img.width,
              height: img.height
            })) || []),
            duration || null,
            trackCount || null,
            masterData.main_release || null,
            mainRelease?.country || null,
            masterData.num_for_sale || 0,
            masterData.lowest_price || null,
            JSON.stringify(dataQuality)
          );
          
          console.log(`  ✅ ${masterData.year || '????'} - ${masterData.title} (${mainRelease?.country || 'Unknown country'})`);
        }
        
        // Check pagination
        if (data.pagination && page < data.pagination.pages) {
          page++;
        } else {
          hasMore = false;
        }
      }
      
      console.log(`\nTotal masters: ${totalMasters}`);
      console.log(`Album masters: ${albumMasters}`);
      
    } catch (error) {
      console.error(`Error fetching ${artist.name}:`, error);
    }
  }
  
  // Show summary
  console.log('\n\n📊 SUMMARY - Master Albums by Artist:');
  console.log('─'.repeat(60));
  
  const summary = db.prepare(`
    SELECT 
      artist_name,
      COUNT(*) as total_albums,
      COUNT(DISTINCT main_release_country) as countries,
      MIN(year) as first_album,
      MAX(year) as last_album
    FROM master_albums
    GROUP BY artist_name
  `).all();
  
  console.log('Artist         | Albums | Countries | Period');
  console.log('---------------|--------|-----------|----------------');
  
  for (const row of summary as any[]) {
    console.log(
      `${row.artist_name.padEnd(14)} | ${String(row.total_albums).padStart(6)} | ${String(row.countries).padStart(9)} | ${row.first_album}-${row.last_album}`
    );
  }
  
  // Show Beatles UK albums specifically
  console.log('\n\n📀 BEATLES UK STUDIO ALBUMS:');
  console.log('─'.repeat(60));
  
  const beatlesUK = db.prepare(`
    SELECT year, title, genres, track_count
    FROM master_albums
    WHERE artist_name = 'The Beatles'
      AND (main_release_country = 'UK' OR country = 'UK')
    ORDER BY year, title
  `).all();
  
  for (const album of beatlesUK as any[]) {
    console.log(`${album.year} - ${album.title}`);
    const genres = JSON.parse(album.genres);
    if (genres.length > 0) {
      console.log(`     Genres: ${genres.join(', ')}`);
    }
    console.log(`     Tracks: ${album.track_count}`);
  }
  
  db.close();
  console.log('\n✅ Data saved to discogs-masters.db');
}

fetchDiscogsMastersOnly().catch(console.error);