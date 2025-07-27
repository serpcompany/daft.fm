#!/usr/bin/env tsx

import Database from 'better-sqlite3';

function queryTrueCanonicalAlbums() {
  console.log('🎯 TRUE Canonical Studio Albums (UK/Original Releases Only)\n');
  
  const db = new Database('album-comparison-rich.db');
  
  // Define canonical Beatles albums
  const canonicalBeatles = [
    'Please Please Me', 'With The Beatles', "A Hard Day's Night", 
    'Beatles For Sale', 'Help!', 'Rubber Soul', 'Revolver',
    "Sgt. Pepper's Lonely Hearts Club Band", 'Magical Mystery Tour',
    'The Beatles', 'Yellow Submarine', 'Abbey Road', 'Let It Be'
  ];
  
  // Query with stricter filtering
  const query = `
    WITH filtered_albums AS (
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
        duration_seconds,
        -- Rank by preferred country (UK first for Beatles, original country for others)
        ROW_NUMBER() OVER (
          PARTITION BY artist_name, 
                       LOWER(REPLACE(REPLACE(album_title, 'The ', ''), ' ', ''))
          ORDER BY 
            CASE 
              WHEN country = 'UK' THEN 1
              WHEN country = 'US' THEN 2
              ELSE 3
            END,
            release_year
        ) as country_rank
      FROM album_comparison_rich
      WHERE 
        is_live = 0 
        AND is_compilation = 0 
        AND is_soundtrack = 0 
        AND is_unofficial = 0
        AND release_year IS NOT NULL
        -- Exclude tribute bands and non-artist albums
        AND album_title NOT LIKE '%Revival Band%'
        AND album_title NOT LIKE '%Songs In Deutsch%'
        AND album_title NOT LIKE '%Heavy, Funky%'
        AND album_title NOT LIKE '%Symphonic Orchestra%'
        -- Exclude obvious compilations that slipped through
        AND album_title NOT LIKE '%Vol.%'
        AND album_title NOT LIKE '%Volume%'
        AND album_title NOT LIKE '%1962-1966%'
        AND album_title NOT LIKE '%1967-1970%'
        AND album_title NOT LIKE '%Capitol Albums%'
    )
    SELECT * FROM filtered_albums
    WHERE country_rank = 1  -- Only keep the primary release for each album
    ORDER BY artist_name, release_year
  `;
  
  const albums = db.prepare(query).all() as any[];
  
  // Group by artist
  const byArtist: Record<string, typeof albums> = {};
  for (const album of albums) {
    if (!byArtist[album.artist_name]) {
      byArtist[album.artist_name] = [];
    }
    byArtist[album.artist_name].push(album);
  }
  
  // Display results
  for (const [artist, artistAlbums] of Object.entries(byArtist)) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎤 ${artist} - ${artistAlbums.length} Studio Albums`);
    console.log('='.repeat(80));
    
    // For Beatles, show canonical list vs what we found
    if (artist === 'The Beatles') {
      const foundTitles = artistAlbums.map(a => a.album_title);
      const missing = canonicalBeatles.filter(title => 
        !foundTitles.some(found => found.toLowerCase().includes(title.toLowerCase()))
      );
      
      if (missing.length > 0) {
        console.log('\n⚠️  Missing canonical albums:');
        missing.forEach(title => console.log(`  - ${title}`));
      }
      
      const extra = foundTitles.filter(found => 
        !canonicalBeatles.some(canon => found.toLowerCase().includes(canon.toLowerCase()))
      );
      
      if (extra.length > 0) {
        console.log('\n⚠️  Extra non-canonical albums:');
        extra.forEach(title => console.log(`  - ${title}`));
      }
    }
    
    console.log('\n📀 Albums:');
    for (const album of artistAlbums) {
      console.log(`\n${album.release_year} - ${album.album_title}`);
      console.log(`  Country: ${album.country}`);
      console.log(`  Tracks: ${album.track_count}`);
      
      if (album.genres) {
        const genres = JSON.parse(album.genres);
        console.log(`  Genres: ${genres.join(', ')}`);
      }
    }
  }
  
  // Show filtering effectiveness
  console.log('\n\n📊 FILTERING EFFECTIVENESS:');
  console.log('─'.repeat(60));
  
  const totalBefore = db.prepare(`
    SELECT COUNT(*) as count 
    FROM album_comparison_rich 
    WHERE artist_name = 'The Beatles'
  `).get() as any;
  
  const totalAfter = albums.filter(a => a.artist_name === 'The Beatles').length;
  
  console.log(`The Beatles:`);
  console.log(`  Before filtering: ${totalBefore.count} albums`);
  console.log(`  After filtering: ${totalAfter} albums`);
  console.log(`  Expected canonical: ${canonicalBeatles.length} albums`);
  
  db.close();
}

queryTrueCanonicalAlbums();