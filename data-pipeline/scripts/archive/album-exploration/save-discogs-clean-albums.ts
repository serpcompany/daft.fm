#!/usr/bin/env tsx

import 'dotenv/config';
import Database from 'better-sqlite3';

// Use the existing comparison database
const db = new Database('album-comparison.db');

// Add new source type for clean Discogs approach
async function saveDiscogsCleanAlbums() {
  console.log('💿 Saving Clean Discogs Albums to Comparison Database\n');
  
  const artists = [
    { name: 'The Beatles', id: '82730' },
    { name: 'Pink Floyd', id: '45467' },
    { name: 'David Bowie', id: '10263' }
  ];
  
  // Clear existing discogs-clean entries
  db.prepare('DELETE FROM album_comparison WHERE source = ?').run('discogs-clean');
  
  for (const artist of artists) {
    console.log(`\nProcessing ${artist.name}...`);
    
    try {
      // Search for master albums
      const searchUrl = new URL('https://api.discogs.com/database/search');
      searchUrl.searchParams.append('artist', artist.name);
      searchUrl.searchParams.append('type', 'master');
      searchUrl.searchParams.append('format', 'Album');
      searchUrl.searchParams.append('per_page', '100');
      searchUrl.searchParams.append('sort', 'year');
      searchUrl.searchParams.append('sort_order', 'asc');
      
      const searchResponse = await fetch(searchUrl.toString(), {
        headers: {
          'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
          'User-Agent': 'DaftFmDataPipeline/1.0'
        }
      });
      
      const searchData = await searchResponse.json();
      
      // Filter to unique studio albums
      const uniqueMasters = new Map<string, any>();
      
      for (const result of searchData.results || []) {
        // Skip unofficial releases
        if (result.format?.some((f: string) => f.includes('Unofficial'))) continue;
        
        // Extract album title
        const albumTitle = result.title.includes(' - ') 
          ? result.title.split(' - ').slice(1).join(' - ')
          : result.title;
        
        // Skip compilations and live albums
        const titleLower = albumTitle.toLowerCase();
        if (titleLower.includes('best of') || 
            titleLower.includes('greatest') ||
            titleLower.includes('collection') ||
            titleLower.includes('live at') ||
            titleLower.includes('live in') ||
            titleLower.includes('anthology') ||
            titleLower.includes('sessions') ||
            titleLower.includes('rarities')) {
          continue;
        }
        
        // Normalize title for deduplication
        const normalized = albumTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Keep the earliest version
        if (!uniqueMasters.has(normalized) || 
            (result.year && result.year < uniqueMasters.get(normalized).year)) {
          uniqueMasters.set(normalized, {
            ...result,
            cleanTitle: albumTitle
          });
        }
      }
      
      // Prepare insert statement
      const stmt = db.prepare(`
        INSERT INTO album_comparison 
        (source, artist_name, album_title, release_year, format, country, track_count, source_id, genres, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      // Insert each unique album
      for (const album of uniqueMasters.values()) {
        // For clean approach, we know these are studio albums
        const notes = album.format?.some((f: string) => f.includes('Compilation')) ? 'Compilation' : null;
        
        stmt.run(
          'discogs-clean',
          artist.name,
          album.cleanTitle,
          album.year || null,
          album.format?.join(', ') || null,
          album.country || null,
          null, // Track count not in search results
          album.master_id || album.id,
          album.genre?.join(', ') || null,
          notes
        );
      }
      
      console.log(`Saved ${uniqueMasters.size} clean albums`);
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Error processing ${artist.name}:`, error);
    }
  }
  
  // Show comparison summary
  console.log('\n\n📊 COMPARISON SUMMARY:');
  console.log('─'.repeat(80));
  
  const results = db.prepare(`
    SELECT 
      source,
      artist_name,
      COUNT(*) as total_albums,
      COUNT(CASE WHEN notes IS NULL THEN 1 END) as clean_albums
    FROM album_comparison
    WHERE artist_name IN (?, ?, ?)
    GROUP BY source, artist_name
    ORDER BY artist_name, source
  `).all('The Beatles', 'Pink Floyd', 'David Bowie');
  
  // Format as table
  console.log('\nSource         | Artist       | Total Albums | Clean Albums');
  console.log('---------------|--------------|--------------|-------------');
  
  for (const row of results as any[]) {
    console.log(
      `${row.source.padEnd(14)} | ${row.artist_name.padEnd(12)} | ${String(row.total_albums).padStart(12)} | ${String(row.clean_albums).padStart(12)}`
    );
  }
  
  console.log('\n✅ Clean Discogs data saved to album-comparison.db');
}

saveDiscogsCleanAlbums().catch(console.error);