#!/usr/bin/env tsx

import 'dotenv/config';
import Database from 'better-sqlite3';

// Create a new database with richer schema
const db = new Database('album-comparison-rich.db');

// Create table with many more fields
db.exec(`
  CREATE TABLE IF NOT EXISTS album_comparison_rich (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Source info
    source TEXT NOT NULL,
    source_id TEXT,
    
    -- Basic album info
    artist_name TEXT NOT NULL,
    artist_id TEXT,
    album_title TEXT NOT NULL,
    release_year INTEGER,
    
    -- Discogs specific
    master_id INTEGER,
    main_release_id INTEGER,
    resource_url TEXT,
    uri TEXT,
    
    -- Format and release info
    format TEXT,
    country TEXT,
    label TEXT,
    catalog_number TEXT,
    barcode TEXT,
    
    -- Content info
    track_count INTEGER,
    duration_seconds INTEGER,
    tracklist TEXT, -- JSON
    
    -- Metadata
    genres TEXT, -- JSON array
    styles TEXT, -- JSON array
    
    -- Images
    cover_image_url TEXT,
    image_count INTEGER,
    images TEXT, -- JSON array
    
    -- Additional data
    videos TEXT, -- JSON array
    artists_sort TEXT,
    data_quality TEXT,
    num_for_sale INTEGER,
    lowest_price REAL,
    
    -- Analysis fields
    notes TEXT,
    is_compilation BOOLEAN DEFAULT 0,
    is_live BOOLEAN DEFAULT 0,
    is_soundtrack BOOLEAN DEFAULT 0,
    is_unofficial BOOLEAN DEFAULT 0,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function fetchAndSaveRichData() {
  console.log('🎯 Fetching Rich Album Data from Discogs\n');
  
  const artists = [
    { name: 'The Beatles', id: '82730' },
    { name: 'Pink Floyd', id: '45467' },
    { name: 'David Bowie', id: '10263' }
  ];
  
  // Clear existing data
  db.prepare('DELETE FROM album_comparison_rich').run();
  
  for (const artist of artists) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎤 Processing ${artist.name}`);
    console.log('='.repeat(80));
    
    try {
      // Step 1: Search for masters
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
      console.log(`Found ${searchData.results?.length || 0} masters`);
      
      // Step 2: Deduplicate
      const uniqueMasters = new Map<string, any>();
      
      for (const result of searchData.results || []) {
        // Extract album title
        const albumTitle = result.title.includes(' - ') 
          ? result.title.split(' - ').slice(1).join(' - ')
          : result.title;
        
        // Skip obvious non-albums
        const titleLower = albumTitle.toLowerCase();
        const isLive = titleLower.includes('live at') || titleLower.includes('live in') || 
                       titleLower.includes('(live)') || titleLower.includes('concert');
        const isCompilation = titleLower.includes('best of') || titleLower.includes('greatest') ||
                             titleLower.includes('collection') || titleLower.includes('anthology');
        const isUnofficial = result.format?.some((f: string) => f.includes('Unofficial'));
        
        // Normalize for deduplication
        const normalized = albumTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Keep earliest or skip if we want studio albums only
        if (!uniqueMasters.has(normalized) || 
            (result.year && result.year < uniqueMasters.get(normalized).year)) {
          uniqueMasters.set(normalized, {
            ...result,
            cleanTitle: albumTitle,
            isLive,
            isCompilation,
            isUnofficial
          });
        }
      }
      
      console.log(`Deduplicated to ${uniqueMasters.size} unique albums`);
      console.log('\nFetching detailed data for each master...');
      
      // Step 3: Fetch master details
      let processed = 0;
      const stmt = db.prepare(`
        INSERT INTO album_comparison_rich (
          source, source_id, artist_name, artist_id, album_title, release_year,
          master_id, main_release_id, resource_url, uri,
          format, country, label, catalog_number, barcode,
          track_count, duration_seconds, tracklist,
          genres, styles,
          cover_image_url, image_count, images,
          videos, artists_sort, data_quality, num_for_sale, lowest_price,
          notes, is_compilation, is_live, is_soundtrack, is_unofficial
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `);
      
      for (const album of uniqueMasters.values()) {
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          // Fetch master details
          const masterResponse = await fetch(
            `https://api.discogs.com/masters/${album.id || album.master_id}`,
            {
              headers: {
                'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
                'User-Agent': 'DaftFmDataPipeline/1.0'
              }
            }
          );
          
          const master = await masterResponse.json();
          
          // Calculate total duration
          let totalDuration = 0;
          if (master.tracklist) {
            for (const track of master.tracklist) {
              if (track.duration) {
                const parts = track.duration.split(':');
                if (parts.length === 2) {
                  totalDuration += parseInt(parts[0]) * 60 + parseInt(parts[1]);
                }
              }
            }
          }
          
          // Determine if soundtrack
          const isSoundtrack = master.genres?.some((g: string) => g.includes('Stage & Screen')) ||
                              album.cleanTitle.toLowerCase().includes('soundtrack');
          
          // Save to database
          stmt.run(
            'discogs-master',
            String(master.id),
            artist.name,
            artist.id,
            album.cleanTitle,
            master.year || null,
            
            master.id,
            master.main_release,
            master.resource_url,
            master.uri,
            
            album.format?.join(', ') || null,
            album.country || null,
            album.label?.join(', ') || null,
            null, // catalog_number not in master
            null, // barcode not in master
            
            master.tracklist?.length || 0,
            totalDuration || null,
            JSON.stringify(master.tracklist || []),
            
            JSON.stringify(master.genres || []),
            JSON.stringify(master.styles || []),
            
            master.images?.[0]?.uri || null,
            master.images?.length || 0,
            JSON.stringify(master.images || []),
            
            JSON.stringify(master.videos || []),
            master.artists_sort || null,
            master.data_quality || null,
            master.num_for_sale || null,
            master.lowest_price || null,
            
            album.notes || null,
            album.isCompilation ? 1 : 0,
            album.isLive ? 1 : 0,
            isSoundtrack ? 1 : 0,
            album.isUnofficial ? 1 : 0
          );
          
          processed++;
          if (processed % 10 === 0) {
            console.log(`  Processed ${processed}/${uniqueMasters.size} albums...`);
          }
          
        } catch (error) {
          console.error(`  Error fetching master ${album.id}:`, error);
        }
      }
      
      console.log(`✅ Completed ${artist.name}: ${processed} albums with rich data`);
      
    } catch (error) {
      console.error(`Error processing ${artist.name}:`, error);
    }
  }
  
  // Show summary
  console.log('\n\n📊 RICH DATA SUMMARY:');
  console.log('─'.repeat(80));
  
  const stats = db.prepare(`
    SELECT 
      artist_name,
      COUNT(*) as total,
      SUM(CASE WHEN is_live = 0 AND is_compilation = 0 AND is_soundtrack = 0 THEN 1 ELSE 0 END) as studio_albums,
      SUM(is_live) as live_albums,
      SUM(is_compilation) as compilations,
      SUM(is_soundtrack) as soundtracks,
      AVG(track_count) as avg_tracks,
      AVG(duration_seconds) / 60 as avg_duration_min,
      SUM(CASE WHEN cover_image_url IS NOT NULL THEN 1 ELSE 0 END) as with_cover
    FROM album_comparison_rich
    GROUP BY artist_name
  `).all();
  
  console.log('\n| Artist | Total | Studio | Live | Comp | Sound | Avg Tracks | Avg Min | Covers |');
  console.log('|--------|-------|--------|------|------|-------|------------|---------|--------|');
  
  for (const row of stats as any[]) {
    console.log(
      `| ${row.artist_name.padEnd(14)} | ${String(row.total).padStart(5)} | ${String(row.studio_albums).padStart(6)} | ${String(row.live_albums).padStart(4)} | ${String(row.compilations).padStart(4)} | ${String(row.soundtracks).padStart(5)} | ${String(Math.round(row.avg_tracks)).padStart(10)} | ${String(Math.round(row.avg_duration_min)).padStart(7)} | ${String(row.with_cover).padStart(6)} |`
    );
  }
  
  console.log('\n✅ Rich data saved to album-comparison-rich.db');
  console.log('View with: npx drizzle-kit studio --url ./album-comparison-rich.db --dialect sqlite');
}

fetchAndSaveRichData().catch(console.error);