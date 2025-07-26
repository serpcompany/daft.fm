#!/usr/bin/env tsx

import { stagingDb } from './staging-db';
import { artists } from '../db/schema';
import { desc } from 'drizzle-orm';

async function viewPopularityStats() {
  console.log('📊 Artist Popularity Stats\n');
  
  // Get all artists sorted by different metrics
  const allArtists = await stagingDb
    .select()
    .from(artists)
    .all();
  
  // Sort by Spotify popularity
  console.log('=== Top Artists by Spotify Popularity (0-100) ===');
  const byPopularity = [...allArtists]
    .filter(a => a.spotifyPopularity !== null)
    .sort((a, b) => (b.spotifyPopularity || 0) - (a.spotifyPopularity || 0));
  
  byPopularity.forEach((artist, i) => {
    console.log(`${i + 1}. ${artist.name}: ${artist.spotifyPopularity}/100`);
  });
  
  // Sort by Last.fm listeners
  console.log('\n=== Top Artists by Last.fm Listeners ===');
  const byListeners = [...allArtists]
    .filter(a => a.lastfmListeners !== null)
    .sort((a, b) => (b.lastfmListeners || 0) - (a.lastfmListeners || 0));
  
  byListeners.forEach((artist, i) => {
    console.log(`${i + 1}. ${artist.name}: ${artist.lastfmListeners?.toLocaleString()} listeners`);
  });
  
  // Sort by Last.fm playcount
  console.log('\n=== Top Artists by Last.fm Total Plays ===');
  const byPlaycount = [...allArtists]
    .filter(a => a.lastfmPlaycount !== null)
    .sort((a, b) => (b.lastfmPlaycount || 0) - (a.lastfmPlaycount || 0));
  
  byPlaycount.forEach((artist, i) => {
    console.log(`${i + 1}. ${artist.name}: ${artist.lastfmPlaycount?.toLocaleString()} plays`);
  });
  
  // Combined score (normalize and average)
  console.log('\n=== Combined Popularity Score ===');
  console.log('(Spotify popularity + normalized listeners/playcount)');
  
  const maxListeners = Math.max(...allArtists.map(a => a.lastfmListeners || 0));
  const maxPlaycount = Math.max(...allArtists.map(a => a.lastfmPlaycount || 0));
  
  const withCombinedScore = allArtists.map(artist => {
    const spotifyScore = artist.spotifyPopularity || 0;
    const listenersScore = artist.lastfmListeners ? (artist.lastfmListeners / maxListeners) * 100 : 0;
    const playcountScore = artist.lastfmPlaycount ? (artist.lastfmPlaycount / maxPlaycount) * 100 : 0;
    
    const combinedScore = (spotifyScore + listenersScore + playcountScore) / 3;
    
    return {
      ...artist,
      combinedScore: Math.round(combinedScore)
    };
  }).sort((a, b) => b.combinedScore - a.combinedScore);
  
  withCombinedScore.forEach((artist, i) => {
    console.log(`${i + 1}. ${artist.name}: ${artist.combinedScore}/100 combined score`);
  });
  
  // Stats summary
  console.log('\n=== Summary ===');
  const avgPopularity = byPopularity.reduce((sum, a) => sum + (a.spotifyPopularity || 0), 0) / byPopularity.length;
  const avgListeners = byListeners.reduce((sum, a) => sum + (a.lastfmListeners || 0), 0) / byListeners.length;
  const avgPlaycount = byPlaycount.reduce((sum, a) => sum + (a.lastfmPlaycount || 0), 0) / byPlaycount.length;
  
  console.log(`Average Spotify popularity: ${Math.round(avgPopularity)}/100`);
  console.log(`Average Last.fm listeners: ${Math.round(avgListeners).toLocaleString()}`);
  console.log(`Average Last.fm plays: ${Math.round(avgPlaycount).toLocaleString()}`);
}

viewPopularityStats().catch(console.error);