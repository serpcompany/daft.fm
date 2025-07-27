#!/usr/bin/env tsx

import 'dotenv/config';

interface DiscogsMaster {
  id: number;
  title: string;
  year: number;
  main_release: number;
  main_release_url: string;
  genres: string[];
  styles: string[];
  tracklist: Array<{
    position: string;
    title: string;
    duration: string;
  }>;
}

async function testDiscogsCleanApproach() {
  console.log('🎯 Testing Discogs Clean Album Approach\n');
  
  const artists = [
    { name: 'The Beatles', id: '82730' },
    { name: 'Pink Floyd', id: '45467' },
    { name: 'David Bowie', id: '10263' }
  ];
  
  for (const artist of artists) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎤 ${artist.name}`);
    console.log('='.repeat(80));
    
    try {
      // Step 1: Search for master albums only
      console.log('\n📋 Step 1: Searching for master albums...');
      
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
      console.log(`Found ${searchData.results?.length || 0} master albums`);
      
      // Step 2: Filter to unique albums (by normalized title)
      const uniqueMasters = new Map<string, any>();
      
      for (const result of searchData.results || []) {
        // Skip unofficial releases
        if (result.format?.some((f: string) => f.includes('Unofficial'))) continue;
        
        // Extract album title (remove artist prefix)
        const albumTitle = result.title.includes(' - ') 
          ? result.title.split(' - ').slice(1).join(' - ')
          : result.title;
        
        // Skip compilations and live albums
        const titleLower = albumTitle.toLowerCase();
        if (titleLower.includes('best of') || 
            titleLower.includes('greatest') ||
            titleLower.includes('collection') ||
            titleLower.includes('live at') ||
            titleLower.includes('live in')) {
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
      
      console.log(`\nFiltered to ${uniqueMasters.size} unique studio albums`);
      
      // Step 3: Fetch details for first 5 albums
      console.log('\n📀 Fetching master details for canonical albums:');
      console.log('─'.repeat(60));
      
      const masters = Array.from(uniqueMasters.values())
        .sort((a, b) => (a.year || 9999) - (b.year || 9999))
        .slice(0, 5); // Just first 5 for demo
      
      for (const master of masters) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
        
        // Fetch master details
        const masterResponse = await fetch(
          `https://api.discogs.com/masters/${master.id || master.master_id}`,
          {
            headers: {
              'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
              'User-Agent': 'DaftFmDataPipeline/1.0'
            }
          }
        );
        
        const masterData: DiscogsMaster = await masterResponse.json();
        
        console.log(`\n${masterData.year} - ${masterData.title}`);
        console.log(`  Master ID: ${masterData.id}`);
        console.log(`  Main Release: ${masterData.main_release}`);
        console.log(`  Genres: ${masterData.genres?.join(', ')}`);
        console.log(`  Styles: ${masterData.styles?.join(', ')}`);
        console.log(`  Tracks: ${masterData.tracklist?.length}`);
        
        // Show tracklist
        if (masterData.tracklist && masterData.tracklist.length <= 15) {
          console.log('  Tracklist:');
          masterData.tracklist.forEach(track => {
            console.log(`    ${track.position}. ${track.title} (${track.duration || 'N/A'})`);
          });
        }
        
        // Optional: Get versions to find earliest official release
        console.log('\n  Checking versions for earliest official release...');
        
        const versionsResponse = await fetch(
          `https://api.discogs.com/masters/${masterData.id}/versions?format=Album&sort=released&sort_order=asc&per_page=5`,
          {
            headers: {
              'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
              'User-Agent': 'DaftFmDataPipeline/1.0'
            }
          }
        );
        
        const versionsData = await versionsResponse.json();
        
        if (versionsData.versions && versionsData.versions.length > 0) {
          const firstOfficial = versionsData.versions[0];
          console.log(`  Earliest version: ${firstOfficial.released} - ${firstOfficial.country} - ${firstOfficial.format}`);
          console.log(`  Release ID: ${firstOfficial.id}`);
        }
      }
      
      // Summary
      console.log('\n\n📊 Summary of approach:');
      console.log(`1. Found ${searchData.results?.length} results from search`);
      console.log(`2. Filtered to ${uniqueMasters.size} unique studio albums`);
      console.log(`3. Each master has rich metadata (genres, styles, tracklist)`);
      console.log(`4. Can use main_release or query versions for canonical pick`);
      
    } catch (error) {
      console.error('Error:', error);
    }
  }
  
  console.log('\n\n✅ CONCLUSION:');
  console.log('─'.repeat(60));
  console.log('This Discogs approach gives us:');
  console.log('- Clean list of studio albums (no duplicates)');
  console.log('- Rich metadata (genres, styles, tracklist)');
  console.log('- Ability to pick canonical version');
  console.log('- Much cleaner than artist releases endpoint!');
}

testDiscogsCleanApproach().catch(console.error);