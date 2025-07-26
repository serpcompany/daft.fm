#!/usr/bin/env tsx

import 'dotenv/config';
import { stagingDb } from './staging-db';
import { artists } from '../db/schema';

// Test Spotify album fetching and entity resolution
async function testSpotifyAlbums() {
  console.log('🎵 Testing Spotify album fetching...\n');
  
  // Get all artists from staging
  const testArtists = await stagingDb
    .select()
    .from(artists)
    .all();
  
  console.log(`Testing with ${testArtists.length} artists from staging\n`);
  
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
  
  for (const artist of testArtists) {
    console.log(`\n=== ${artist.name} ===`);
    console.log(`Spotify ID: ${artist.spotifyArtistId}`);
    console.log(`MusicBrainz ID: ${artist.musicbrainzId}`);
    
    if (!artist.spotifyArtistId) {
      console.log('❌ No Spotify ID - would need to search by name');
      
      // Test search by name
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(artist.name)}&type=artist&limit=5`,
        {
          headers: { 'Authorization': `Bearer ${access_token}` }
        }
      );
      
      const searchData = await searchResponse.json();
      console.log(`\nSearch results for "${artist.name}":`);
      searchData.artists?.items?.forEach((result: any) => {
        console.log(`- ${result.name} (ID: ${result.id})`);
        console.log(`  Popularity: ${result.popularity}, Followers: ${result.followers?.total}`);
      });
      
      continue;
    }
    
    // Get albums (only actual albums, not singles/compilations)
    const albumsResponse = await fetch(
      `https://api.spotify.com/v1/artists/${artist.spotifyArtistId}/albums?include_groups=album&limit=50&market=US`,
      {
        headers: { 'Authorization': `Bearer ${access_token}` }
      }
    );
    
    const albumsData = await albumsResponse.json();
    
    console.log(`\nTotal albums: ${albumsData.total}`);
    
    // Group albums by normalized name to find duplicates
    const albumGroups: Record<string, any[]> = {};
    
    for (const album of albumsData.items || []) {
      // Normalize name by removing parenthetical additions
      const normalizedName = album.name
        .replace(/\s*\([^)]*\)/g, '') // Remove (Remastered), (Deluxe), etc.
        .replace(/\s*\[[^\]]*\]/g, '') // Remove [Special Edition], etc.
        .trim();
      
      if (!albumGroups[normalizedName]) {
        albumGroups[normalizedName] = [];
      }
      albumGroups[normalizedName].push(album);
    }
    
    console.log(`\nUnique albums (after normalization): ${Object.keys(albumGroups).length}`);
    
    console.log('\nAlbums with multiple versions:');
    Object.entries(albumGroups)
      .filter(([_, versions]) => versions.length > 1)
      .forEach(([name, versions]) => {
        console.log(`\n"${name}" has ${versions.length} versions:`);
        versions.forEach(v => {
          console.log(`  - ${v.name} (${v.release_date})`);
        });
      });
    
    console.log('\nCanonical albums (earliest version):');
    const canonical = Object.entries(albumGroups).map(([name, versions]) => {
      // Sort by release date and take the earliest
      return versions.sort((a, b) => a.release_date.localeCompare(b.release_date))[0];
    }).sort((a, b) => a.release_date.localeCompare(b.release_date));
    
    canonical.forEach(album => {
      console.log(`${album.release_date} - ${album.name}`);
      console.log(`              Spotify ID: ${album.id}`);
      console.log(`              Tracks: ${album.total_tracks}`);
      console.log(`              Cover: ${album.images?.[0]?.url ? 'Yes' : 'No'}`);
    });
    
    // Test entity resolution - can we match back to MusicBrainz?
    if (canonical.length > 0) {
      console.log('\n=== ENTITY RESOLUTION TEST ===');
      const testAlbum = canonical[0];
      console.log(`\nTrying to match "${testAlbum.name}" (${testAlbum.release_date}) back to MusicBrainz...`);
      
      // Search MusicBrainz for this album
      const mbSearchUrl = `https://musicbrainz.org/ws/2/release-group/?query=release:"${encodeURIComponent(testAlbum.name)}" AND artist:"${encodeURIComponent(artist.name)}"&fmt=json&limit=5`;
      
      console.log(`Searching: ${mbSearchUrl}`);
      
      const mbResponse = await fetch(mbSearchUrl, {
        headers: { 'User-Agent': 'DaftFmDataPipeline/1.0' }
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
      
      const mbData = await mbResponse.json();
      
      if (mbData['release-groups']?.length > 0) {
        console.log(`\nFound ${mbData['release-groups'].length} potential matches:`);
        mbData['release-groups'].forEach((rg: any) => {
          console.log(`- ${rg.title} (${rg['first-release-date']})`);
          console.log(`  Score: ${rg.score}, Type: ${rg['primary-type']}`);
          console.log(`  MBID: ${rg.id}`);
        });
      }
    }
  }
}

testSpotifyAlbums().catch(console.error);