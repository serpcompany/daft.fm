#!/usr/bin/env tsx

import { stagingDb } from './staging-db';
import { albums } from '../db/schema';

async function compareSpotifyDiscogsClean() {
  console.log('📊 Comparing Spotify vs Ideal Canonical Albums\n');
  
  // Get current Spotify albums
  const spotifyAlbums = await stagingDb
    .select()
    .from(albums)
    .orderBy(albums.artistId, albums.releaseDate)
    .all();
  
  // Categorize Spotify albums
  const byArtist: Record<number, { studio: any[], live: any[], other: any[] }> = {};
  
  for (const album of spotifyAlbums) {
    if (!byArtist[album.artistId]) {
      byArtist[album.artistId] = { studio: [], live: [], other: [] };
    }
    
    const title = album.title.toLowerCase();
    
    // Categorize
    if (title.includes('live') || title.includes('(live)')) {
      byArtist[album.artistId].live.push(album);
    } else if (title.includes('soundtrack') || title.includes('bbc') || 
               title.includes('storytellers') || title.includes('(2023 edition)') ||
               title.includes('(2018 remaster)') || title.includes('(2019 mix)')) {
      byArtist[album.artistId].other.push(album);
    } else {
      byArtist[album.artistId].studio.push(album);
    }
  }
  
  // Show breakdown
  const artists = ['The Beatles', 'Pink Floyd', 'David Bowie'];
  
  for (let i = 0; i < artists.length; i++) {
    const artistId = i + 1;
    const artistName = artists[i];
    const data = byArtist[artistId];
    
    console.log(`\n🎤 ${artistName}`);
    console.log('─'.repeat(60));
    console.log(`Spotify gave us: ${data.studio.length + data.live.length + data.other.length} total`);
    console.log(`- Studio albums: ${data.studio.length}`);
    console.log(`- Live albums: ${data.live.length}`);
    console.log(`- Other (soundtracks, remasters, etc): ${data.other.length}`);
    
    console.log('\n📀 ACTUAL CANONICAL STUDIO ALBUMS:');
    
    // Filter to true studio albums
    const canonicalStudio = data.studio.filter(album => {
      const title = album.title.toLowerCase();
      // Remove obvious non-canonical
      return !title.includes('remaster') && 
             !title.includes('remix') &&
             !title.includes('deluxe') &&
             !title.includes('edition') &&
             !title.includes('anniversary');
    });
    
    console.log(`True studio albums: ${canonicalStudio.length}\n`);
    
    for (const album of canonicalStudio) {
      const year = new Date(album.releaseDate).getFullYear();
      console.log(`${year} - ${album.title}`);
    }
  }
  
  console.log('\n\n💡 RECOMMENDATION:');
  console.log('─'.repeat(60));
  console.log('1. Use Spotify API but apply stricter filtering:');
  console.log('   - Remove all live albums');
  console.log('   - Remove all remastered/deluxe/anniversary editions');
  console.log('   - Remove soundtracks and compilations');
  console.log('   - Keep only the original studio releases');
  console.log('\n2. Then enrich with Discogs master data for:');
  console.log('   - Genres and styles');
  console.log('   - Additional images');
  console.log('   - Credits and personnel');
  
  // Show what we should have
  console.log('\n\n📋 EXPECTED CANONICAL ALBUMS:');
  console.log('─'.repeat(60));
  
  console.log('\nThe Beatles (~13 studio albums):');
  const beatlesCanonical = [
    'Please Please Me', 'With The Beatles', 'A Hard Day\'s Night', 
    'Beatles For Sale', 'Help!', 'Rubber Soul', 'Revolver',
    'Sgt. Pepper\'s Lonely Hearts Club Band', 'Magical Mystery Tour',
    'The Beatles (White Album)', 'Yellow Submarine', 'Abbey Road', 'Let It Be'
  ];
  beatlesCanonical.forEach(a => console.log(`- ${a}`));
  
  console.log('\nPink Floyd (~15 studio albums):');
  const floydCanonical = [
    'The Piper at the Gates of Dawn', 'A Saucerful of Secrets', 
    'More', 'Ummagumma', 'Atom Heart Mother', 'Meddle', 
    'Obscured by Clouds', 'The Dark Side of the Moon',
    'Wish You Were Here', 'Animals', 'The Wall', 'The Final Cut',
    'A Momentary Lapse of Reason', 'The Division Bell', 'The Endless River'
  ];
  floydCanonical.forEach(a => console.log(`- ${a}`));
}

compareSpotifyDiscogsClean().catch(console.error);