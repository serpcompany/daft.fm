#!/usr/bin/env tsx

import { stagingDb } from './staging-db';
import { artists, albums, songs, artistMembers } from '../db/schema';

async function viewStaging() {
  console.log('\n📊 Staging Database Contents\n');
  
  // Artists
  const allArtists = await stagingDb.select().from(artists).all();
  console.log(`Artists: ${allArtists.length}`);
  
  for (const artist of allArtists.slice(0, 10)) {
    const genres = artist.genres ? JSON.parse(artist.genres) : [];
    console.log(`  - ${artist.name} (${artist.country || 'Unknown'}) - ${genres.slice(0, 3).join(', ')}`);
  }
  
  if (allArtists.length > 10) {
    console.log(`  ... and ${allArtists.length - 10} more`);
  }
  
  // Albums
  const allAlbums = await stagingDb.select().from(albums).all();
  console.log(`\nAlbums: ${allAlbums.length}`);
  
  // Songs
  const allSongs = await stagingDb.select().from(songs).all();
  console.log(`Songs: ${allSongs.length}`);
  
  // Artist Members
  const allMembers = await stagingDb.select().from(artistMembers).all();
  console.log(`\nArtist Members: ${allMembers.length}`);
  
  // Sample external IDs
  if (allArtists.length > 0) {
    console.log('\nSample External IDs:');
    const sample = allArtists[0];
    const externalIds = JSON.parse(sample.externalIds || '{}');
    console.log(`${sample.name}:`, externalIds);
  }
}

viewStaging();