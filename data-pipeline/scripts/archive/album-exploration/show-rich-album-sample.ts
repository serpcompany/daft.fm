#!/usr/bin/env tsx

import 'dotenv/config';
import Database from 'better-sqlite3';

async function showRichAlbumSample() {
  console.log('📀 Sample of Rich Album Data\n');
  
  const db = new Database('album-comparison-rich.db');
  
  // Check what we have so far
  const count = db.prepare('SELECT COUNT(*) as count FROM album_comparison_rich').get() as any;
  console.log(`Current albums in database: ${count.count}\n`);
  
  // Show a sample album with all fields
  const sample = db.prepare(`
    SELECT * FROM album_comparison_rich 
    WHERE artist_name = 'The Beatles' 
    AND is_live = 0 
    AND is_compilation = 0
    LIMIT 1
  `).get() as any;
  
  if (sample) {
    console.log('SAMPLE ALBUM - All Fields:');
    console.log('─'.repeat(60));
    console.log(`Title: ${sample.album_title}`);
    console.log(`Artist: ${sample.artist_name}`);
    console.log(`Year: ${sample.release_year}`);
    console.log(`Master ID: ${sample.master_id}`);
    console.log(`Format: ${sample.format}`);
    console.log(`Country: ${sample.country}`);
    console.log(`Track Count: ${sample.track_count}`);
    console.log(`Duration: ${sample.duration_seconds ? Math.round(sample.duration_seconds / 60) + ' minutes' : 'N/A'}`);
    console.log(`Genres: ${sample.genres}`);
    console.log(`Styles: ${sample.styles}`);
    console.log(`Cover Image: ${sample.cover_image_url ? 'Yes' : 'No'}`);
    console.log(`Total Images: ${sample.image_count}`);
    console.log(`Data Quality: ${sample.data_quality}`);
    console.log(`For Sale: ${sample.num_for_sale || 0} copies`);
    console.log(`Lowest Price: ${sample.lowest_price ? '$' + sample.lowest_price : 'N/A'}`);
    
    // Show tracklist
    if (sample.tracklist) {
      const tracks = JSON.parse(sample.tracklist);
      console.log(`\nTracklist (${tracks.length} tracks):`);
      tracks.slice(0, 5).forEach((track: any) => {
        console.log(`  ${track.position}. ${track.title} (${track.duration || 'N/A'})`);
      });
      if (tracks.length > 5) console.log(`  ... and ${tracks.length - 5} more tracks`);
    }
    
    // Show images
    if (sample.images) {
      const images = JSON.parse(sample.images);
      console.log(`\nImages (${images.length} total):`);
      images.slice(0, 2).forEach((img: any) => {
        console.log(`  - ${img.type}: ${img.width}x${img.height}`);
      });
    }
  }
  
  // Show statistics
  const stats = db.prepare(`
    SELECT 
      artist_name,
      COUNT(*) as total,
      SUM(CASE WHEN is_live = 0 AND is_compilation = 0 AND is_soundtrack = 0 THEN 1 ELSE 0 END) as studio_albums,
      AVG(track_count) as avg_tracks,
      COUNT(DISTINCT genres) as genre_variety,
      SUM(CASE WHEN cover_image_url IS NOT NULL THEN 1 ELSE 0 END) as with_images
    FROM album_comparison_rich
    GROUP BY artist_name
  `).all() as any[];
  
  console.log('\n\nSTATISTICS:');
  console.log('─'.repeat(60));
  console.log('Artist         | Total | Studio | Avg Tracks | Has Images');
  console.log('---------------|-------|--------|------------|------------');
  
  for (const row of stats) {
    console.log(
      `${row.artist_name.padEnd(14)} | ${String(row.total).padStart(5)} | ${String(row.studio_albums).padStart(6)} | ${String(Math.round(row.avg_tracks)).padStart(10)} | ${String(row.with_images).padStart(10)}`
    );
  }
  
  // Quick example: fetch one more album to show the process
  console.log('\n\nFETCHING ONE MORE ALBUM AS EXAMPLE:');
  console.log('─'.repeat(60));
  
  try {
    const masterResponse = await fetch(
      'https://api.discogs.com/masters/24047', // Abbey Road
      {
        headers: {
          'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
          'User-Agent': 'DaftFmDataPipeline/1.0'
        }
      }
    );
    
    const master = await masterResponse.json();
    
    console.log(`Title: ${master.title}`);
    console.log(`Year: ${master.year}`);
    console.log(`Genres: ${master.genres?.join(', ')}`);
    console.log(`Styles: ${master.styles?.join(', ')}`);
    console.log(`Tracks: ${master.tracklist?.length}`);
    console.log(`Images: ${master.images?.length}`);
    console.log(`Videos: ${master.videos?.length}`);
    console.log(`Main Release ID: ${master.main_release}`);
    console.log(`Versions URL: ${master.versions_url}`);
    
  } catch (error) {
    console.error('Error fetching example:', error);
  }
  
  db.close();
}

showRichAlbumSample().catch(console.error);