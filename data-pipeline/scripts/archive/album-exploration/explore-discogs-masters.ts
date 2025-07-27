#!/usr/bin/env tsx

import 'dotenv/config';

async function exploreDiscogsMasters() {
  console.log('🎵 Exploring Discogs Masters structure...\n');
  
  const beatlesDiscogsId = '82730';
  
  try {
    // First, let's see what we get with just type=master
    console.log('=== FETCHING ONLY MASTERS ===');
    const mastersResponse = await fetch(
      `https://api.discogs.com/artists/${beatlesDiscogsId}/releases?type=master&per_page=100`,
      {
        headers: {
          'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
          'User-Agent': 'DaftFmDataPipeline/1.0'
        }
      }
    );
    
    const mastersData = await mastersResponse.json();
    console.log(`Total masters: ${mastersData.pagination?.items || 0}`);
    
    // Group by format to understand what we're getting
    const formats: Record<string, any[]> = {};
    
    mastersData.releases?.forEach((release: any) => {
      const format = release.format || 'Unknown';
      if (!formats[format]) formats[format] = [];
      formats[format].push(release);
    });
    
    console.log('\nFormats found:');
    Object.entries(formats).forEach(([format, releases]) => {
      console.log(`\n${format} (${releases.length} releases):`);
      releases.slice(0, 5).forEach(r => {
        console.log(`  - ${r.title} (${r.year}) [Master ID: ${r.id}]`);
      });
    });
    
    // Now let's look at a specific master to see its structure
    console.log('\n=== DETAILED MASTER EXAMPLE ===');
    
    // Find "Please Please Me" album
    const pleasePleaseMeAlbum = mastersData.releases?.find((r: any) => 
      r.title === 'Please Please Me' && r.format?.includes('Album')
    );
    
    if (pleasePleaseMeAlbum) {
      console.log(`\nFetching master details for: ${pleasePleaseMeAlbum.title}`);
      console.log(`Master ID: ${pleasePleaseMeAlbum.id}`);
      
      // Get master details
      const masterResponse = await fetch(
        `https://api.discogs.com/masters/${pleasePleaseMeAlbum.id}`,
        {
          headers: {
            'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
            'User-Agent': 'DaftFmDataPipeline/1.0'
          }
        }
      );
      
      const masterData = await masterResponse.json();
      
      console.log('\nMaster details:');
      console.log(`- Title: ${masterData.title}`);
      console.log(`- Year: ${masterData.year}`);
      console.log(`- Artists: ${masterData.artists?.map((a: any) => a.name).join(', ')}`);
      console.log(`- Genres: ${masterData.genres?.join(', ')}`);
      console.log(`- Styles: ${masterData.styles?.join(', ')}`);
      console.log(`- Tracks: ${masterData.tracklist?.length}`);
      console.log(`- Images: ${masterData.images?.length}`);
      console.log(`- Num releases: ${masterData.num_for_sale}`);
      console.log(`- Main release ID: ${masterData.main_release}`);
      
      if (masterData.tracklist) {
        console.log('\nTracklist:');
        masterData.tracklist.forEach((track: any, i: number) => {
          console.log(`  ${i+1}. ${track.title} (${track.duration || 'N/A'})`);
        });
      }
    }
    
    // Let's also check what album-type masters they have
    console.log('\n=== ALBUM-TYPE MASTERS ===');
    const albumMasters = mastersData.releases?.filter((r: any) => 
      r.format?.toLowerCase().includes('album') || 
      r.format?.toLowerCase().includes('lp')
    ) || [];
    
    console.log(`\nFound ${albumMasters.length} album-type masters:`);
    albumMasters.forEach((album: any) => {
      console.log(`- ${album.title} (${album.year}) - Format: ${album.format}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

exploreDiscogsMasters().catch(console.error);