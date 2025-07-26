#!/usr/bin/env tsx

import 'dotenv/config';

async function testDiscogsDaftPunk() {
  console.log('🎵 Testing Discogs with Daft Punk...\n');
  
  // Daft Punk artist ID from their URL
  const daftPunkId = '1289';
  
  try {
    // Get all their releases
    const response = await fetch(
      `https://api.discogs.com/artists/${daftPunkId}/releases?per_page=100&sort=year`,
      {
        headers: {
          'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
          'User-Agent': 'DaftFmDataPipeline/1.0'
        }
      }
    );
    
    const data = await response.json();
    console.log(`Total releases: ${data.pagination?.items || 0}`);
    
    // Group by type and format
    const masters: any[] = [];
    const albums: any[] = [];
    const singles: any[] = [];
    const compilations: any[] = [];
    
    for (const release of data.releases || []) {
      if (release.role !== 'Main') continue; // Skip appearances, remixes
      
      const format = release.format || '';
      const title = release.title;
      
      // Categorize like Discogs frontend does
      if (release.type === 'master') {
        if (format.includes('Album') || format.includes('LP') || format.includes('CD')) {
          if (title.includes('Remix') || format.includes('Comp')) {
            compilations.push(release);
          } else {
            albums.push(release);
          }
        } else if (format.includes('Single') || format.includes('EP') || format.includes('12"') || format.includes('7"')) {
          singles.push(release);
        } else {
          masters.push(release); // Other masters
        }
      }
    }
    
    console.log('\nBreakdown (Main artist only):');
    console.log(`- Albums: ${albums.length}`);
    console.log(`- Singles & EPs: ${singles.length}`);
    console.log(`- Compilations: ${compilations.length}`);
    console.log(`- Other masters: ${masters.length}`);
    
    console.log('\n=== ALBUMS ===');
    albums.forEach(album => {
      console.log(`${album.year} - ${album.title}`);
      console.log(`     Master ID: ${album.id}`);
      console.log(`     Format: ${album.format || 'Unknown'}\n`);
    });
    
    // Get details for Homework master
    const homework = albums.find(a => a.title === 'Homework');
    if (homework) {
      console.log('\n=== HOMEWORK MASTER DETAILS ===');
      
      const masterResponse = await fetch(
        `https://api.discogs.com/masters/${homework.id}`,
        {
          headers: {
            'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
            'User-Agent': 'DaftFmDataPipeline/1.0'
          }
        }
      );
      
      const masterData = await masterResponse.json();
      
      console.log(`Title: ${masterData.title}`);
      console.log(`Year: ${masterData.year}`);
      console.log(`Tracks: ${masterData.tracklist?.length}`);
      console.log(`Genres: ${masterData.genres?.join(', ')}`);
      console.log(`Styles: ${masterData.styles?.join(', ')}`);
      console.log(`Images: ${masterData.images?.length}`);
      console.log(`Number of versions: ${masterData.num_for_sale || 'N/A'}`);
      console.log(`Main release: ${masterData.main_release}`);
      
      // URL structure
      console.log(`\nURL: https://www.discogs.com/master/${homework.id}-${homework.title.replace(/\s+/g, '-')}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDiscogsDaftPunk().catch(console.error);