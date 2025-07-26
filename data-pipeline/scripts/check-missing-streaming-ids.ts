#!/usr/bin/env tsx

import { stagingDb } from './staging-db';
import { artists } from '../db/schema';

async function checkMissingStreamingIds() {
  console.log('🔍 Checking for missing streaming platform IDs...\n');
  
  // Get all artists
  const allArtists = await stagingDb.select().from(artists).all();
  
  if (allArtists.length === 0) {
    console.log('No artists in staging database. Run save-artists-to-staging.ts first.');
    return;
  }
  
  console.log(`Total artists in staging: ${allArtists.length}\n`);
  
  // Check each artist for missing IDs
  const missingAppleMusic: string[] = [];
  const missingDeezer: string[] = [];
  const missingTidal: string[] = [];
  
  for (const artist of allArtists) {
    const externalIds = JSON.parse(artist.externalIds || '{}');
    
    // Check if these IDs exist in externalIds or as direct fields
    if (!externalIds.appleMusicId && !externalIds.apple_music_id) {
      missingAppleMusic.push(artist.name);
    }
    
    if (!externalIds.deezerArtistId && !externalIds.deezer_artist_id && !artist.deezerArtistId) {
      missingDeezer.push(artist.name);
    }
    
    if (!externalIds.tidalArtistId && !externalIds.tidal_artist_id && !artist.tidalArtistId) {
      missingTidal.push(artist.name);
    }
  }
  
  console.log(`Missing Apple Music ID: ${missingAppleMusic.length}/${allArtists.length}`);
  if (missingAppleMusic.length > 0) {
    console.log('Artists without Apple Music ID:');
    missingAppleMusic.forEach(name => console.log(`  - ${name}`));
  }
  
  console.log(`\nMissing Deezer ID: ${missingDeezer.length}/${allArtists.length}`);
  if (missingDeezer.length > 0) {
    console.log('Artists without Deezer ID:');
    missingDeezer.forEach(name => console.log(`  - ${name}`));
  }
  
  console.log(`\nMissing Tidal ID: ${missingTidal.length}/${allArtists.length}`);
  if (missingTidal.length > 0) {
    console.log('Artists without Tidal ID:');
    missingTidal.forEach(name => console.log(`  - ${name}`));
  }
  
  // Also show what we DO have for a sample artist
  if (allArtists.length > 0) {
    console.log('\n📋 Sample artist external IDs:');
    const sample = allArtists[0];
    console.log(`\n${sample.name}:`);
    console.log(`  Spotify ID: ${sample.spotifyArtistId || 'None'}`);
    console.log(`  Discogs ID: ${sample.discogsArtistId || 'None'}`);
    console.log(`  Last.fm URL: ${sample.lastfmUrl || 'None'}`);
    console.log(`  All external IDs:`, JSON.parse(sample.externalIds || '{}'));
  }
}

// Run the check
checkMissingStreamingIds().catch(console.error);