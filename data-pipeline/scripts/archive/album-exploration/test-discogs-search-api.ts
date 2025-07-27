#!/usr/bin/env tsx

import 'dotenv/config';

async function testDiscogsSearchAPI() {
  console.log('🎵 Testing Discogs Database Search API for Albums\n');
  
  const artists = [
    { name: 'The Beatles', discogsId: '82730' },
    { name: 'Pink Floyd', discogsId: '45467' },
    { name: 'David Bowie', discogsId: '10263' }
  ];
  
  for (const artist of artists) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎤 ${artist.name}`);
    console.log(`${'='.repeat(80)}`);
    
    try {
      // Use Database Search API with type=master and format=Album
      const searchUrl = new URL('https://api.discogs.com/database/search');
      searchUrl.searchParams.append('artist', artist.name);
      searchUrl.searchParams.append('type', 'master');
      searchUrl.searchParams.append('format', 'Album');
      searchUrl.searchParams.append('per_page', '100');
      searchUrl.searchParams.append('sort', 'year');
      searchUrl.searchParams.append('sort_order', 'asc');
      
      console.log(`URL: ${searchUrl.toString()}\n`);
      
      const response = await fetch(searchUrl.toString(), {
        headers: {
          'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
          'User-Agent': 'DaftFmDataPipeline/1.0'
        }
      });
      
      const data = await response.json();
      
      console.log(`Total results: ${data.pagination?.items || 0}`);
      
      // Show the albums
      console.log('\n📀 STUDIO ALBUMS (type=master, format=Album):');
      console.log('─'.repeat(50));
      
      const albums = data.results || [];
      
      for (const album of albums) {
        console.log(`${album.year || '????'} - ${album.title}`);
        console.log(`      Master ID: ${album.master_id || album.id}`);
        console.log(`      Format: ${album.format?.join(', ') || 'Unknown'}`);
        console.log(`      Country: ${album.country || 'Unknown'}`);
        console.log(`      Label: ${album.label?.join(', ') || 'Unknown'}`);
        
        // Check if it has genre/style data
        if (album.genre || album.style) {
          console.log(`      Genres: ${album.genre?.join(', ') || 'N/A'}`);
          console.log(`      Styles: ${album.style?.join(', ') || 'N/A'}`);
        }
        console.log('');
      }
      
      // Summary
      console.log(`\n📊 Summary:`);
      console.log(`- Total albums found: ${albums.length}`);
      
      // Check what formats we got
      const formats = new Set<string>();
      albums.forEach(a => a.format?.forEach((f: string) => formats.add(f)));
      console.log(`- Formats found: ${Array.from(formats).join(', ')}`);
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('Error:', error);
    }
  }
  
  console.log('\n\n💡 INSIGHTS:');
  console.log('─'.repeat(50));
  console.log('Using type=master and format=Album filters out singles and gives us:');
  console.log('- Proper album releases only');
  console.log('- Master IDs we can use to fetch full details');
  console.log('- Basic metadata including year, country, label');
  console.log('- But NO genre/style data in search results (need to fetch master)');
}

testDiscogsSearchAPI().catch(console.error);