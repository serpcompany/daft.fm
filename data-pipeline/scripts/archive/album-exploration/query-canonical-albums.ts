#!/usr/bin/env tsx

import Database from 'better-sqlite3';

function queryCanonicalAlbums() {
  console.log('🎯 Canonical Studio Albums from Rich Discogs Data\n');
  
  const db = new Database('album-comparison-rich.db');
  
  // Query for clean canonical studio albums
  const canonicalAlbums = db.prepare(`
    SELECT 
      artist_name,
      album_title,
      release_year,
      track_count,
      genres,
      styles,
      format,
      country,
      master_id,
      cover_image_url,
      data_quality,
      duration_seconds
    FROM album_comparison_rich
    WHERE 
      is_live = 0 
      AND is_compilation = 0 
      AND is_soundtrack = 0 
      AND is_unofficial = 0
      AND release_year IS NOT NULL
    ORDER BY artist_name, release_year
  `).all() as any[];
  
  // Group by artist
  const byArtist: Record<string, typeof canonicalAlbums> = {};
  for (const album of canonicalAlbums) {
    if (!byArtist[album.artist_name]) {
      byArtist[album.artist_name] = [];
    }
    byArtist[album.artist_name].push(album);
  }
  
  // Display results
  for (const [artist, albums] of Object.entries(byArtist)) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎤 ${artist} - ${albums.length} Studio Albums`);
    console.log('='.repeat(80));
    
    for (const album of albums) {
      console.log(`\n${album.release_year} - ${album.album_title}`);
      console.log(`  Tracks: ${album.track_count}`);
      console.log(`  Duration: ${album.duration_seconds ? Math.round(album.duration_seconds / 60) + ' min' : 'N/A'}`);
      console.log(`  Format: ${album.format}`);
      console.log(`  Country: ${album.country}`);
      
      if (album.genres) {
        const genres = JSON.parse(album.genres);
        console.log(`  Genres: ${genres.join(', ')}`);
      }
      
      if (album.styles) {
        const styles = JSON.parse(album.styles);
        console.log(`  Styles: ${styles.join(', ')}`);
      }
      
      console.log(`  Master ID: ${album.master_id}`);
      console.log(`  Cover: ${album.cover_image_url ? '✅' : '❌'}`);
      console.log(`  Data Quality: ${album.data_quality}`);
    }
  }
  
  // Summary of filtering
  const totalAlbums = db.prepare('SELECT COUNT(*) as count FROM album_comparison_rich').get() as any;
  const liveAlbums = db.prepare('SELECT COUNT(*) as count FROM album_comparison_rich WHERE is_live = 1').get() as any;
  const compilations = db.prepare('SELECT COUNT(*) as count FROM album_comparison_rich WHERE is_compilation = 1').get() as any;
  const soundtracks = db.prepare('SELECT COUNT(*) as count FROM album_comparison_rich WHERE is_soundtrack = 1').get() as any;
  
  console.log('\n\n📊 FILTERING SUMMARY:');
  console.log('─'.repeat(60));
  console.log(`Total albums fetched: ${totalAlbums.count}`);
  console.log(`Filtered out:`);
  console.log(`  - Live albums: ${liveAlbums.count}`);
  console.log(`  - Compilations: ${compilations.count}`);
  console.log(`  - Soundtracks: ${soundtracks.count}`);
  console.log(`Final canonical studio albums: ${canonicalAlbums.length}`);
  
  // Regional variations check
  console.log('\n\n🌍 REGIONAL VARIATIONS:');
  console.log('─'.repeat(60));
  
  const beatlesVariations = db.prepare(`
    SELECT album_title, COUNT(*) as versions, GROUP_CONCAT(DISTINCT country) as countries
    FROM album_comparison_rich
    WHERE artist_name = 'The Beatles' 
      AND is_live = 0 
      AND is_compilation = 0
    GROUP BY album_title
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 5
  `).all() as any[];
  
  if (beatlesVariations.length > 0) {
    console.log('Albums with multiple country versions (Beatles):');
    for (const album of beatlesVariations) {
      console.log(`- "${album.album_title}": ${album.versions} versions (${album.countries})`);
    }
  }
  
  db.close();
}

queryCanonicalAlbums().catch(console.error);