#!/usr/bin/env tsx

import { stagingDb } from './staging-db';
import { albums } from '../db/schema';
import { eq } from 'drizzle-orm';

async function showDataExamples() {
  console.log('📊 EXAMPLES OF DATA QUALITY ISSUES\n');
  
  // Get some Beatles albums from our current staging data
  const beatlesAlbums = await stagingDb
    .select()
    .from(albums)
    .where(eq(albums.artistId, 1))
    .limit(10)
    .all();
  
  console.log('🎤 THE BEATLES - Current Spotify Data:');
  console.log('─'.repeat(60));
  for (const album of beatlesAlbums) {
    const year = new Date(album.releaseDate).getFullYear();
    console.log(`${year} - ${album.title}`);
  }
  
  console.log('\n❌ Issues:');
  console.log('- Every album says "(Remastered)" - not the original titles');
  console.log('- "Live At The BBC" is not a studio album');
  console.log('- "Yellow Submarine Songtrack" is a 2014 compilation');
  
  // Get some Bowie albums
  const bowieAlbums = await stagingDb
    .select()
    .from(albums)
    .where(eq(albums.artistId, 3))
    .orderBy(albums.releaseDate)
    .limit(15)
    .all();
  
  console.log('\n\n🎤 DAVID BOWIE - Current Spotify Data:');
  console.log('─'.repeat(60));
  for (const album of bowieAlbums) {
    const year = new Date(album.releaseDate).getFullYear();
    console.log(`${year} - ${album.title}`);
  }
  
  console.log('\n❌ Issues:');
  console.log('- "Space Oddity (2019 Mix)" - should just be "Space Oddity"');
  console.log('- "Live Nassau Coliseum \'76" - live album mixed with studio');
  console.log('- Multiple versions of same album (2 "Never Let Me Down" entries)');
  
  console.log('\n\n📀 WHAT WE ACTUALLY WANT:');
  console.log('─'.repeat(60));
  
  console.log('\nThe Beatles canonical studio albums:');
  const beatlesCanonical = [
    '1963 - Please Please Me',
    '1963 - With The Beatles', 
    '1964 - A Hard Day\'s Night',
    '1964 - Beatles For Sale',
    '1965 - Help!',
    '1965 - Rubber Soul',
    '1966 - Revolver',
    '1967 - Sgt. Pepper\'s Lonely Hearts Club Band',
    '1967 - Magical Mystery Tour',
    '1968 - The Beatles (White Album)',
    '1969 - Yellow Submarine',
    '1969 - Abbey Road',
    '1970 - Let It Be'
  ];
  beatlesCanonical.forEach(a => console.log(a));
  
  console.log('\nDavid Bowie first 10 canonical studio albums:');
  const bowieCanonical = [
    '1967 - David Bowie',
    '1969 - Space Oddity',
    '1970 - The Man Who Sold The World',
    '1971 - Hunky Dory',
    '1972 - The Rise and Fall of Ziggy Stardust',
    '1973 - Aladdin Sane',
    '1973 - Pin Ups',
    '1974 - Diamond Dogs',
    '1975 - Young Americans',
    '1976 - Station to Station'
  ];
  bowieCanonical.forEach(a => console.log(a));
  
  console.log('\n\n🔍 DISCOGS COMPARISON:');
  console.log('─'.repeat(60));
  console.log('Discogs returns multiple versions of the same album:');
  console.log('\nExample: "Sgt. Pepper" on Discogs returns:');
  console.log('- Master ID: 23934 (UK, 1967)');
  console.log('- Master ID: 1264303 (Denmark, 1967)');
  console.log('- Master ID: 1264296 (Norway, 1967)');
  console.log('- Master ID: 1264290 (Canada, 1967)');
  console.log('- Master ID: 1264285 (Ecuador, 1967)');
  console.log('... and 10+ more country variations!');
  
  console.log('\n\n💡 SOLUTION:');
  console.log('─'.repeat(60));
  console.log('1. Create a curated list of canonical albums (like above)');
  console.log('2. Match to Spotify to get:');
  console.log('   - Cover art URL');
  console.log('   - Track count');
  console.log('   - Spotify album ID');
  console.log('3. Match to Discogs masters to get:');
  console.log('   - Genres & styles');
  console.log('   - Original release year');
  console.log('   - Additional images');
  console.log('4. Store clean titles without "(Remastered)" suffixes');
}

showDataExamples().catch(console.error);