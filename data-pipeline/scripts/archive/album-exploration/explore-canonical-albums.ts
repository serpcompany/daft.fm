#!/usr/bin/env tsx

import 'dotenv/config';

// Let's explore CANONICAL albums only
async function exploreCanonicalAlbums() {
  console.log('🎵 Exploring CANONICAL album counts...\n');
  
  const beatlesMbid = 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d';
  const beatlesDiscogsId = '82730';
  const beatlesSpotifyId = '3WrFJ7ztbogyGnTHbHJFl2';
  
  console.log('=== MUSICBRAINZ ALBUM TYPES ===');
  await analyzeMusicBrainzTypes(beatlesMbid);
  
  console.log('\n=== DISCOGS MASTERS ===');
  await analyzeDiscogsMasters(beatlesDiscogsId);
  
  console.log('\n=== SPOTIFY ALBUM GROUPS ===');
  await analyzeSpotifyAlbums(beatlesSpotifyId);
}

async function analyzeMusicBrainzTypes(mbid: string) {
  try {
    // Get just primary albums (not compilations, lives, etc)
    const url = `https://musicbrainz.org/ws/2/release-group?artist=${mbid}&type=album&fmt=json&limit=100`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'DaftFmDataPipeline/1.0' }
    });
    
    const data = await response.json();
    
    console.log(`Total "album" type: ${data['release-group-count']}`);
    
    // Count by secondary types
    const types: Record<string, number> = {};
    const canonicalAlbums = [];
    
    for (const rg of data['release-groups']) {
      const secondaryTypes = rg['secondary-types'] || [];
      if (secondaryTypes.length === 0) {
        // No secondary type = studio album
        canonicalAlbums.push(rg);
        types['Studio Album'] = (types['Studio Album'] || 0) + 1;
      } else {
        secondaryTypes.forEach((type: string) => {
          types[type] = (types[type] || 0) + 1;
        });
      }
    }
    
    console.log('\nBreakdown:');
    Object.entries(types).forEach(([type, count]) => {
      console.log(`- ${type}: ${count}`);
    });
    
    console.log('\nCanonical studio albums:');
    canonicalAlbums.slice(0, 20).forEach(album => {
      console.log(`- ${album.title} (${album['first-release-date']})`);
    });
    
  } catch (error) {
    console.error('MusicBrainz error:', error);
  }
}

async function analyzeDiscogsMasters(discogsId: string) {
  try {
    // Get ONLY master releases
    const response = await fetch(
      `https://api.discogs.com/artists/${discogsId}/releases?sort=year&type=master&per_page=100`,
      {
        headers: {
          'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
          'User-Agent': 'DaftFmDataPipeline/1.0'
        }
      }
    );
    
    const data = await response.json();
    
    console.log(`Total master releases: ${data.pagination?.items || 0}`);
    
    // Filter for main releases (exclude compilations, etc)
    const mainReleases = data.releases?.filter((r: any) => 
      r.role === 'Main' && r.type === 'master'
    ) || [];
    
    console.log(`Main artist masters: ${mainReleases.length}`);
    
    console.log('\nFirst 20 master releases:');
    mainReleases.slice(0, 20).forEach((release: any) => {
      console.log(`- ${release.title} (${release.year})`);
    });
    
  } catch (error) {
    console.error('Discogs error:', error);
  }
}

async function analyzeSpotifyAlbums(spotifyId: string) {
  try {
    // Get token
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
    
    // Get ONLY albums (not singles, compilations)
    const albumsResponse = await fetch(
      `https://api.spotify.com/v1/artists/${spotifyId}/albums?include_groups=album&limit=50`,
      {
        headers: { 'Authorization': `Bearer ${access_token}` }
      }
    );
    
    const albums = await albumsResponse.json();
    
    console.log(`Total albums (not singles/compilations): ${albums.total}`);
    
    console.log('\nAll Spotify albums:');
    albums.items?.forEach((album: any) => {
      console.log(`- ${album.name} (${album.release_date})`);
    });
    
  } catch (error) {
    console.error('Spotify error:', error);
  }
}

// Run exploration
exploreCanonicalAlbums().catch(console.error);