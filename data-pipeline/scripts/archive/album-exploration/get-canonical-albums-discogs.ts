#!/usr/bin/env tsx

import 'dotenv/config';

interface DiscogsRelease {
  id: number;
  master_id?: number;
  title: string;
  year: number;
  format: string;
  type: 'master' | 'release';
  thumb: string;
}

async function getCanonicalAlbumsFromDiscogs() {
  console.log('🎵 Getting canonical albums from Discogs...\n');
  
  const beatlesDiscogsId = '82730';
  
  try {
    // Get ALL releases
    const allReleases: DiscogsRelease[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= 5) { // Limit pages for testing
      const response = await fetch(
        `https://api.discogs.com/artists/${beatlesDiscogsId}/releases?page=${page}&per_page=100`,
        {
          headers: {
            'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
            'User-Agent': 'DaftFmDataPipeline/1.0'
          }
        }
      );
      
      const data = await response.json();
      allReleases.push(...(data.releases || []));
      
      hasMore = page < data.pagination?.pages;
      page++;
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Fetched ${allReleases.length} total releases`);
    
    // Filter to find album-like formats
    const albumFormats = ['LP', 'Album', 'CD', 'Cassette'];
    const singleFormats = ['7"', 'Single', 'EP', 'Maxi'];
    
    // Group by master ID to find unique albums
    const masters = new Map<number, DiscogsRelease>();
    const albums: DiscogsRelease[] = [];
    
    for (const release of allReleases) {
      const format = release.format || '';
      
      // Check if it's an album format
      const isAlbum = albumFormats.some(f => format.includes(f)) &&
                      !singleFormats.some(f => format.includes(f)) &&
                      !format.includes('Comp') && // Skip compilations
                      !format.includes('Unofficial'); // Skip bootlegs
      
      if (isAlbum) {
        if (release.type === 'master') {
          // It's a master, add it
          masters.set(release.id, release);
        } else if (release.master_id && !masters.has(release.master_id)) {
          // It's a release with a master, add the master info
          masters.set(release.master_id, {
            ...release,
            id: release.master_id,
            type: 'master'
          });
        } else if (!release.master_id) {
          // Standalone release without master
          albums.push(release);
        }
      }
    }
    
    // Combine masters and standalone albums
    const canonicalAlbums = [...masters.values(), ...albums]
      .sort((a, b) => (a.year || 9999) - (b.year || 9999));
    
    console.log(`\nFound ${canonicalAlbums.length} canonical albums:\n`);
    
    for (const album of canonicalAlbums) {
      console.log(`${album.year || '????'} - ${album.title}`);
      console.log(`     ${album.type === 'master' ? 'Master' : 'Release'} ID: ${album.id}`);
      console.log(`     Format: ${album.format || 'Unknown'}`);
      if (album.thumb) {
        console.log(`     Thumbnail: Available`);
      }
      console.log('');
    }
    
    // Now let's get detailed info for one master
    if (canonicalAlbums.length > 0 && canonicalAlbums[0].type === 'master') {
      console.log('\n=== MASTER DETAILS EXAMPLE ===');
      const masterId = canonicalAlbums[0].id;
      
      const masterResponse = await fetch(
        `https://api.discogs.com/masters/${masterId}`,
        {
          headers: {
            'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
            'User-Agent': 'DaftFmDataPipeline/1.0'
          }
        }
      );
      
      const masterData = await masterResponse.json();
      
      console.log(`\nMaster: ${masterData.title} (${masterData.year})`);
      console.log(`Tracks: ${masterData.tracklist?.length || 0}`);
      console.log(`Images: ${masterData.images?.length || 0}`);
      console.log(`Main Release ID: ${masterData.main_release}`);
      
      if (masterData.tracklist && masterData.tracklist.length > 0) {
        console.log('\nTracklist:');
        masterData.tracklist.slice(0, 5).forEach((track: any, i: number) => {
          console.log(`  ${i+1}. ${track.title}`);
        });
        if (masterData.tracklist.length > 5) {
          console.log(`  ... and ${masterData.tracklist.length - 5} more tracks`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

getCanonicalAlbumsFromDiscogs().catch(console.error);