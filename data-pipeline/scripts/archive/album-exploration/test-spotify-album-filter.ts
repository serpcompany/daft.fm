#!/usr/bin/env tsx

import 'dotenv/config';

async function getSpotifyToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });
  
  const data = await response.json();
  return data.access_token;
}

async function testSpotifyAlbumFilter() {
  console.log('🎯 Testing Spotify API with album_type=album filter\n');
  
  const token = await getSpotifyToken();
  
  const artists = [
    { name: 'The Beatles', id: '3WrFJ7ztbogyGnTHbHJFl2' },
    { name: 'Pink Floyd', id: '0k17h0D3J5VfsdmQ1iZtE9' },
    { name: 'David Bowie', id: '0oSGxfWSnnOXhD2fKuz2Gy' }
  ];
  
  for (const artist of artists) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎤 ${artist.name}`);
    console.log('='.repeat(60));
    
    // Fetch albums with include_groups=album filter
    const url = `https://api.spotify.com/v1/artists/${artist.id}/albums?include_groups=album&limit=50&market=US`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    console.log(`\nTotal albums returned: ${data.items.length}`);
    
    // Group by album name to check for duplicates
    const albumsByName: Record<string, any[]> = {};
    
    for (const album of data.items) {
      const cleanName = album.name.replace(/ \(.*?\)$/, ''); // Remove parenthetical suffixes
      if (!albumsByName[cleanName]) {
        albumsByName[cleanName] = [];
      }
      albumsByName[cleanName].push(album);
    }
    
    console.log(`Unique album titles: ${Object.keys(albumsByName).length}`);
    console.log('\n📀 Albums:');
    
    // Sort by release date
    const sortedAlbums = data.items.sort((a: any, b: any) => 
      a.release_date.localeCompare(b.release_date)
    );
    
    for (const album of sortedAlbums) {
      console.log(`  ${album.release_date.substring(0, 4)} - ${album.name}`);
      console.log(`       Type: ${album.album_type}`);
      console.log(`       Total tracks: ${album.total_tracks}`);
    }
    
    // Check for duplicates
    const duplicates = Object.entries(albumsByName).filter(([_, versions]) => versions.length > 1);
    if (duplicates.length > 0) {
      console.log('\n🔍 Duplicates found:');
      for (const [cleanName, versions] of duplicates) {
        console.log(`\n  "${cleanName}" has ${versions.length} versions:`);
        for (const v of versions) {
          console.log(`    - ${v.release_date}: ${v.name}`);
        }
      }
    }
  }
  
  // Compare with expected canonical albums
  console.log('\n\n📊 BEATLES CANONICAL CHECK:');
  console.log('─'.repeat(60));
  
  const canonicalBeatles = [
    'Please Please Me', 'With The Beatles', "A Hard Day's Night", 
    'Beatles For Sale', 'Help!', 'Rubber Soul', 'Revolver',
    "Sgt. Pepper's Lonely Hearts Club Band", 'Magical Mystery Tour',
    'The Beatles', 'Yellow Submarine', 'Abbey Road', 'Let It Be'
  ];
  
  const response = await fetch(
    `https://api.spotify.com/v1/artists/3WrFJ7ztbogyGnTHbHJFl2/albums?include_groups=album&limit=50&market=US`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const beatlesData = await response.json();
  
  const spotifyTitles = beatlesData.items.map((a: any) => 
    a.name.replace(/ \(.*?\)$/, '')
  );
  
  const uniqueSpotifyTitles = [...new Set(spotifyTitles)];
  
  console.log(`Canonical albums: ${canonicalBeatles.length}`);
  console.log(`Spotify unique titles: ${uniqueSpotifyTitles.length}`);
  
  const missing = canonicalBeatles.filter(title => 
    !uniqueSpotifyTitles.some(spotify => 
      spotify.toLowerCase() === title.toLowerCase()
    )
  );
  
  if (missing.length > 0) {
    console.log('\n⚠️  Missing canonical albums:');
    missing.forEach(title => console.log(`  - ${title}`));
  }
  
  const extra = uniqueSpotifyTitles.filter(spotify => 
    !canonicalBeatles.some(canon => 
      spotify.toLowerCase() === canon.toLowerCase()
    )
  );
  
  if (extra.length > 0) {
    console.log('\n⚠️  Extra non-canonical albums:');
    extra.forEach(title => console.log(`  - ${title}`));
  }
}

testSpotifyAlbumFilter().catch(console.error);