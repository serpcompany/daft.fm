#!/usr/bin/env tsx

import 'dotenv/config';
import { stagingDb } from './staging-db';
import { artists } from '../db/schema';

// Test getting album data from various sources
async function exploreAlbumSources() {
  console.log('🎵 Exploring album data sources...\n');
  
  // Get The Beatles for testing (they have well-documented discography)
  const testArtist = await stagingDb
    .select()
    .from(artists)
    .where((artist: any) => artist.name === 'The Beatles')
    .limit(1)
    .all();
  
  if (testArtist.length === 0) {
    console.log('The Beatles not found in staging DB');
    return;
  }
  
  const beatles = testArtist[0];
  console.log(`Testing with: ${beatles.name}`);
  console.log(`MusicBrainz ID: ${beatles.musicbrainzId}`);
  console.log(`Spotify ID: ${beatles.spotifyArtistId}`);
  console.log(`Discogs ID: ${beatles.discogsArtistId}\n`);
  
  // Test each source
  console.log('=== MUSICBRAINZ RELEASE GROUPS ===');
  await testMusicBrainz(beatles.musicbrainzId!);
  
  console.log('\n=== DISCOGS DISCOGRAPHY ===');
  if (beatles.discogsArtistId) {
    const discogsId = beatles.discogsArtistId.replace(/[\[\]a]/g, '');
    await testDiscogs(discogsId);
  }
  
  console.log('\n=== SPOTIFY ALBUMS ===');
  if (beatles.spotifyArtistId) {
    await testSpotify(beatles.spotifyArtistId);
  }
}

async function testMusicBrainz(mbid: string) {
  try {
    const url = `https://musicbrainz.org/ws/2/release-group?artist=${mbid}&type=album|ep&fmt=json&limit=5`;
    
    console.log('Fetching:', url);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DaftFmDataPipeline/1.0 (https://daft.fm)'
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
    
    const data = await response.json();
    
    console.log(`Found ${data['release-group-count']} release groups total`);
    console.log('\nFirst 5 albums:');
    
    for (const rg of data['release-groups']) {
      console.log(`\n- ${rg.title} (${rg['first-release-date']})`);
      console.log(`  Type: ${rg['primary-type']}`);
      console.log(`  ID: ${rg.id}`);
      
      // Get details for first release
      if (rg.releases && rg.releases.length > 0) {
        const releaseId = rg.releases[0].id;
        await getReleaseDetails(releaseId);
      }
    }
  } catch (error) {
    console.error('MusicBrainz error:', error);
  }
}

async function getReleaseDetails(releaseId: string) {
  try {
    const url = `https://musicbrainz.org/ws/2/release/${releaseId}?inc=recordings&fmt=json`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DaftFmDataPipeline/1.0 (https://daft.fm)'
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
    
    const release = await response.json();
    
    console.log(`  Tracks: ${release.media?.[0]?.tracks?.length || 'Unknown'}`);
    console.log(`  Barcode: ${release.barcode || 'None'}`);
    console.log(`  Cover Art: Check https://coverartarchive.org/release/${releaseId}`);
    
  } catch (error) {
    console.error('  Error getting release details');
  }
}

async function testDiscogs(discogsId: string) {
  try {
    const response = await fetch(`https://api.discogs.com/artists/${discogsId}/releases?sort=year&sort_order=asc&per_page=5`, {
      headers: {
        'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
        'User-Agent': 'DaftFmDataPipeline/1.0'
      }
    });
    
    const data = await response.json();
    
    console.log(`Found ${data.pagination?.items || 0} releases total`);
    console.log('\nFirst 5 releases:');
    
    for (const release of data.releases || []) {
      console.log(`\n- ${release.title} (${release.year})`);
      console.log(`  Type: ${release.type}`);
      console.log(`  Role: ${release.role}`);
      console.log(`  Master ID: ${release.master_id || 'None'}`);
      console.log(`  Release ID: ${release.id}`);
      console.log(`  Thumb: ${release.thumb || 'None'}`);
      console.log(`  Label: ${release.label || 'Unknown'}`);
      console.log(`  Catalog: ${release.catno || 'None'}`);
    }
    
  } catch (error) {
    console.error('Discogs error:', error);
  }
}

async function testSpotify(spotifyId: string) {
  try {
    // Get token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.SPOTIFY_CLIENT_ID!,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET!
      })
    });
    
    const { access_token } = await tokenResponse.json();
    
    // Get albums
    const albumsResponse = await fetch(
      `https://api.spotify.com/v1/artists/${spotifyId}/albums?include_groups=album,single&limit=5`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      }
    );
    
    const albums = await albumsResponse.json();
    
    console.log(`Found ${albums.total} albums total`);
    console.log('\nFirst 5 albums:');
    
    for (const album of albums.items || []) {
      console.log(`\n- ${album.name} (${album.release_date})`);
      console.log(`  Type: ${album.album_type}`);
      console.log(`  ID: ${album.id}`);
      console.log(`  Tracks: ${album.total_tracks}`);
      console.log(`  Cover: ${album.images?.[0]?.url || 'None'}`);
      console.log(`  Artists: ${album.artists.map((a: any) => a.name).join(', ')}`);
    }
    
  } catch (error) {
    console.error('Spotify error:', error);
  }
}

// Run exploration
exploreAlbumSources().catch(console.error);