#!/usr/bin/env tsx

import 'dotenv/config';

async function testDiscogsFormats() {
  console.log('🎵 Testing Discogs format filtering...\n');
  
  const beatlesDiscogsId = '82730';
  
  try {
    // Try filtering by format
    const response = await fetch(
      `https://api.discogs.com/artists/${beatlesDiscogsId}/releases?sort=year&format=album&type=master&per_page=100`,
      {
        headers: {
          'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
          'User-Agent': 'DaftFmDataPipeline/1.0'
        }
      }
    );
    
    const data = await response.json();
    
    console.log(`Total results with format=album: ${data.pagination?.items || 0}`);
    
    // Group by format
    const formats: Record<string, number> = {};
    
    data.releases?.forEach((release: any) => {
      const format = release.format || 'Unknown';
      formats[format] = (formats[format] || 0) + 1;
      
      // Show albums only
      if (format?.toLowerCase().includes('album') || format?.toLowerCase().includes('lp')) {
        console.log(`- ${release.title} (${release.year}) - Format: ${format}`);
      }
    });
    
    console.log('\nFormat breakdown:');
    Object.entries(formats).forEach(([format, count]) => {
      console.log(`- ${format}: ${count}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDiscogsFormats().catch(console.error);