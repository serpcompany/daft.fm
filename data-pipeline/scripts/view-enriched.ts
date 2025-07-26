#!/usr/bin/env tsx

import { stagingDb } from './staging-db';
import { artists } from '../db/schema';

async function viewEnrichedData() {
  const enrichedArtists = await stagingDb
    .select()
    .from(artists)
    .all();
  
  console.log('🎨 Enriched Artists Data\n');
  
  for (const artist of enrichedArtists) {
    console.log(`\n=== ${artist.name} ===`);
    console.log(`Bio: ${artist.bio ? artist.bio.substring(0, 100) + '...' : 'None'}`);
    console.log(`Images: ${artist.images || 'None'}`);
    console.log(`Enriched Genres: ${artist.enrichedGenres || 'None'}`);
    console.log(`Spotify Popularity: ${artist.spotifyPopularity || 'N/A'}`);
    console.log(`Last.fm Listeners: ${artist.lastfmListeners?.toLocaleString() || 'N/A'}`);
    console.log(`Last.fm Playcount: ${artist.lastfmPlaycount?.toLocaleString() || 'N/A'}`);
    console.log(`Data Sources: ${artist.dataSourcesUsed || 'None'}`);
    console.log(`Last Enriched: ${artist.lastEnriched || 'Never'}`);
  }
}

viewEnrichedData().catch(console.error);