#!/usr/bin/env tsx

import 'dotenv/config';

async function testDiscogsArtistReleases() {
  console.log('🎯 Testing Discogs Artist Releases Endpoint\n');
  
  const artist = { name: 'The Beatles', id: '82730' };
  
  console.log(`Fetching releases for ${artist.name}...`);
  
  const url = `https://api.discogs.com/artists/${artist.id}/releases?page=1&per_page=100&sort=year&sort_order=asc`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
      'User-Agent': 'DaftFmDataPipeline/1.0'
    }
  });
  
  const data = await response.json();
  
  console.log(`\nTotal releases: ${data.pagination?.items || 0}`);
  console.log(`This page: ${data.releases?.length || 0}`);
  console.log(`Total pages: ${data.pagination?.pages || 0}`);
  
  // Categorize releases
  const categories = {
    albums: [] as any[],
    singles: [] as any[],
    compilations: [] as any[],
    other: [] as any[]
  };
  
  for (const release of data.releases || []) {
    const format = release.format || '';
    const title = release.title.toLowerCase();
    
    if (release.role !== 'Main') continue; // Skip appearances, remixes, etc.
    
    if (format.includes('Single') || format.includes('EP') || 
        format.includes('7"') || format.includes('45 RPM')) {
      categories.singles.push(release);
    } else if (format.includes('Comp') || title.includes('greatest') || 
               title.includes('best of') || title.includes('collection')) {
      categories.compilations.push(release);
    } else if (release.type === 'master' && 
               (format.includes('Album') || format.includes('LP') || 
                format.includes('CD') || format === '')) {
      categories.albums.push(release);
    } else {
      categories.other.push(release);
    }
  }
  
  console.log('\nBreakdown (Main artist releases only):');
  console.log(`- Albums: ${categories.albums.length}`);
  console.log(`- Singles: ${categories.singles.length}`);
  console.log(`- Compilations: ${categories.compilations.length}`);
  console.log(`- Other: ${categories.other.length}`);
  
  console.log('\n📀 ALBUMS (first 20):');
  console.log('─'.repeat(60));
  
  for (const album of categories.albums.slice(0, 20)) {
    console.log(`\n${album.year || '????'} - ${album.title}`);
    console.log(`  Type: ${album.type}`);
    console.log(`  Format: ${album.format}`);
    console.log(`  Label: ${album.label}`);
    console.log(`  Country: ${album.country || 'Not specified'}`);
    console.log(`  Master ID: ${album.id}`);
    console.log(`  Thumb: ${album.thumb ? '✅' : '❌'}`);
  }
  
  // Show how to filter for UK releases
  console.log('\n\n🇬🇧 UK ALBUMS ONLY:');
  console.log('─'.repeat(60));
  
  const ukAlbums = categories.albums.filter(a => a.country === 'UK');
  
  for (const album of ukAlbums) {
    console.log(`${album.year || '????'} - ${album.title}`);
  }
  
  console.log(`\nFound ${ukAlbums.length} UK albums on this page`);
}

testDiscogsArtistReleases().catch(console.error);