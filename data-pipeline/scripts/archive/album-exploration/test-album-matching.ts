#!/usr/bin/env tsx

import 'dotenv/config';

async function testAlbumMatching() {
  console.log('🎯 EXAMPLE: Matching "Abbey Road" across APIs\n');
  
  const targetAlbum = {
    artist: 'The Beatles',
    title: 'Abbey Road',
    year: 1969
  };
  
  // Get Spotify token
  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET!
    })
  });
  const { access_token } = await tokenResponse.json();
  
  // 1. Search Spotify
  console.log('🎵 SPOTIFY SEARCH:');
  console.log('─'.repeat(50));
  
  const spotifySearchUrl = `https://api.spotify.com/v1/search?q=album:"${targetAlbum.title}" artist:"${targetAlbum.artist}"&type=album&limit=5`;
  
  const spotifyResponse = await fetch(spotifySearchUrl, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  
  const spotifyData = await spotifyResponse.json();
  
  console.log(`Found ${spotifyData.albums?.items?.length || 0} results:\n`);
  
  for (const album of spotifyData.albums?.items || []) {
    console.log(`Title: "${album.name}"`);
    console.log(`Artist: ${album.artists?.[0]?.name}`);
    console.log(`Release: ${album.release_date}`);
    console.log(`Type: ${album.album_type}`);
    console.log(`Tracks: ${album.total_tracks}`);
    console.log(`Spotify ID: ${album.id}`);
    console.log(`Cover: ${album.images?.[0]?.url ? 'Yes' : 'No'}`);
    console.log('');
  }
  
  // 2. Search Discogs
  console.log('\n💿 DISCOGS SEARCH:');
  console.log('─'.repeat(50));
  
  const discogsSearchUrl = new URL('https://api.discogs.com/database/search');
  discogsSearchUrl.searchParams.append('artist', targetAlbum.artist);
  discogsSearchUrl.searchParams.append('release_title', targetAlbum.title);
  discogsSearchUrl.searchParams.append('type', 'master');
  discogsSearchUrl.searchParams.append('format', 'Album');
  
  const discogsResponse = await fetch(discogsSearchUrl.toString(), {
    headers: {
      'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
      'User-Agent': 'DaftFmDataPipeline/1.0'
    }
  });
  
  const discogsData = await discogsResponse.json();
  
  console.log(`Found ${discogsData.results?.length || 0} results:\n`);
  
  // Show first few results
  for (const result of (discogsData.results || []).slice(0, 5)) {
    console.log(`Title: "${result.title}"`);
    console.log(`Year: ${result.year}`);
    console.log(`Country: ${result.country}`);
    console.log(`Master ID: ${result.master_id || result.id}`);
    console.log(`Format: ${result.format?.join(', ')}`);
    if (result.genre || result.style) {
      console.log(`Genres: ${result.genre?.join(', ')}`);
      console.log(`Styles: ${result.style?.join(', ')}`);
    }
    console.log('');
  }
  
  // 3. Fetch the UK master for full details
  if (discogsData.results?.length > 0) {
    const ukMaster = discogsData.results.find((r: any) => r.country === 'UK') || discogsData.results[0];
    
    console.log('\n📋 DISCOGS MASTER DETAILS:');
    console.log('─'.repeat(50));
    
    const masterResponse = await fetch(
      `https://api.discogs.com/masters/${ukMaster.master_id || ukMaster.id}`,
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
    console.log(`Genres: ${masterData.genres?.join(', ')}`);
    console.log(`Styles: ${masterData.styles?.join(', ')}`);
    console.log(`Tracks: ${masterData.tracklist?.length}`);
    console.log(`Images: ${masterData.images?.length}`);
    console.log('\nTracklist:');
    masterData.tracklist?.forEach((track: any) => {
      console.log(`  ${track.position}. ${track.title} (${track.duration})`);
    });
  }
  
  console.log('\n\n✅ FINAL RESULT:');
  console.log('─'.repeat(50));
  console.log('For our canonical album "Abbey Road" (1969), we would store:');
  console.log('\nFrom our curated list:');
  console.log('- Title: "Abbey Road" (clean, no remaster suffix)');
  console.log('- Year: 1969');
  console.log('\nFrom Spotify:');
  console.log('- Spotify ID: 0ETFjACtuP2ADo6LFhL6HN');
  console.log('- Cover art URL: https://i.scdn.co/image/...');
  console.log('- Track count: 17');
  console.log('\nFrom Discogs:');
  console.log('- Master ID: 24047');
  console.log('- Genres: Rock');
  console.log('- Styles: Pop Rock');
}

testAlbumMatching().catch(console.error);