#!/usr/bin/env tsx

import 'dotenv/config';

async function testDiscogsAPI() {
  console.log('🎵 Testing Discogs API parameters...\n');
  
  const beatlesDiscogsId = '82730';
  
  try {
    // Test different parameter combinations
    const tests = [
      { params: 'type=master&format=album', desc: 'Masters with album format' },
      { params: 'type=master&format=LP', desc: 'Masters with LP format' },
      { params: 'format=album', desc: 'All releases with album format' },
      { params: '', desc: 'All releases (no filter)' }
    ];
    
    for (const test of tests) {
      console.log(`\n=== ${test.desc} ===`);
      const url = `https://api.discogs.com/artists/${beatlesDiscogsId}/releases?${test.params}&per_page=20&sort=year`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
          'User-Agent': 'DaftFmDataPipeline/1.0'
        }
      });
      
      const data = await response.json();
      console.log(`Total results: ${data.pagination?.items || 0}`);
      
      // Show first 5 with format info
      console.log('\nFirst 5 results:');
      data.releases?.slice(0, 5).forEach((r: any) => {
        console.log(`- ${r.title} (${r.year})`);
        console.log(`  Type: ${r.type}, Format: ${r.format}, Role: ${r.role}`);
        console.log(`  ${r.type === 'master' ? 'Master' : 'Release'} ID: ${r.id}`);
      });
    }
    
    // Let's also check the artist endpoint to see what Discogs says about their discography
    console.log('\n\n=== ARTIST INFO ===');
    const artistResponse = await fetch(
      `https://api.discogs.com/artists/${beatlesDiscogsId}`,
      {
        headers: {
          'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
          'User-Agent': 'DaftFmDataPipeline/1.0'
        }
      }
    );
    
    const artistData = await artistResponse.json();
    console.log(`Artist: ${artistData.name}`);
    console.log(`Members: ${artistData.members?.map((m: any) => m.name).join(', ')}`);
    console.log(`Profile: ${artistData.profile?.substring(0, 100)}...`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDiscogsAPI().catch(console.error);