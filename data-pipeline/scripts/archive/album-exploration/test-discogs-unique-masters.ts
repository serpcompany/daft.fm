#!/usr/bin/env tsx

import 'dotenv/config';

async function testDiscogsUniqueMasters() {
  console.log('🎵 Testing Discogs - Getting Unique Master Albums Only\n');
  
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
      // Search for master albums
      const searchUrl = new URL('https://api.discogs.com/database/search');
      searchUrl.searchParams.append('artist', artist.name);
      searchUrl.searchParams.append('type', 'master');
      searchUrl.searchParams.append('format', 'Album');
      searchUrl.searchParams.append('per_page', '100');
      searchUrl.searchParams.append('sort', 'year');
      searchUrl.searchParams.append('sort_order', 'asc');
      
      const response = await fetch(searchUrl.toString(), {
        headers: {
          'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
          'User-Agent': 'DaftFmDataPipeline/1.0'
        }
      });
      
      const data = await response.json();
      const allAlbums = data.results || [];
      
      console.log(`Raw results: ${allAlbums.length}`);
      
      // Group by normalized title to find unique albums
      const uniqueAlbums = new Map<string, any>();
      
      for (const album of allAlbums) {
        // Skip compilations, live albums, unofficial
        const title = album.title.toLowerCase();
        const formats = (album.format || []).join(' ').toLowerCase();
        
        if (formats.includes('unofficial') || 
            formats.includes('compilation') ||
            title.includes('live at') ||
            title.includes('live in') ||
            title.includes('(live)') ||
            title.includes('best of') ||
            title.includes('greatest') ||
            title.includes('collection') ||
            title.includes('anthology')) {
          continue;
        }
        
        // Extract just the album name (remove artist prefix)
        const albumTitle = album.title
          .replace(/^[^-]+-\s*/, '') // Remove "The Beatles - " prefix
          .replace(/\s*\([^)]*\)/g, '') // Remove parenthetical
          .replace(/\s*\[[^\]]*\]/g, '') // Remove brackets
          .trim();
        
        const normalizedTitle = albumTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Keep the earliest version of each album
        if (!uniqueAlbums.has(normalizedTitle) || 
            (album.year && album.year < uniqueAlbums.get(normalizedTitle).year)) {
          uniqueAlbums.set(normalizedTitle, {
            ...album,
            cleanTitle: albumTitle
          });
        }
      }
      
      // Convert to array and sort by year
      const canonicalAlbums = Array.from(uniqueAlbums.values())
        .sort((a, b) => (a.year || 9999) - (b.year || 9999));
      
      console.log(`\nUnique studio albums: ${canonicalAlbums.length}`);
      console.log('\n📀 CANONICAL STUDIO ALBUMS:');
      console.log('─'.repeat(50));
      
      for (const album of canonicalAlbums) {
        console.log(`${album.year || '????'} - ${album.cleanTitle}`);
        console.log(`      Master ID: ${album.master_id || album.id}`);
        console.log(`      Country: ${album.country}`);
        if (album.genre || album.style) {
          console.log(`      Genres: ${album.genre?.join(', ')}`);
          console.log(`      Styles: ${album.style?.join(', ')}`);
        }
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('Error:', error);
    }
  }
  
  console.log('\n\n💡 KEY FINDINGS:');
  console.log('─'.repeat(50));
  console.log('Discogs Database Search with type=master and format=Album:');
  console.log('✓ Returns rich metadata (genres, styles, country, label)');
  console.log('✓ Can filter to just masters (no individual releases)');
  console.log('✗ Still includes multiple country versions of same album');
  console.log('✗ Includes some compilations despite format=Album');
  console.log('\nRECOMMENDATION: Use this to get master IDs, then fetch');
  console.log('individual masters for full details and canonical version.');
}

testDiscogsUniqueMasters().catch(console.error);