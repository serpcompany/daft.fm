#!/usr/bin/env tsx

import { stagingDb } from './staging-db';
import { artists, albums } from '../db/schema';
import { eq } from 'drizzle-orm';

async function albumSummary() {
  console.log('💿 Album Database Summary\n');
  
  // Get all albums with artist info
  const allAlbums = await stagingDb
    .select({
      albumId: albums.id,
      albumTitle: albums.title,
      albumSlug: albums.slug,
      releaseDate: albums.releaseDate,
      trackCount: albums.trackCount,
      spotifyId: albums.spotifyAlbumId,
      artistName: artists.name,
      artistId: artists.id
    })
    .from(albums)
    .leftJoin(artists, eq(albums.artistId, artists.id))
    .orderBy(artists.name, albums.releaseDate)
    .all();
  
  // Group by artist
  const byArtist: Record<string, typeof allAlbums> = {};
  for (const album of allAlbums) {
    const key = album.artistName || 'Unknown';
    if (!byArtist[key]) byArtist[key] = [];
    byArtist[key].push(album);
  }
  
  // Display summary
  for (const [artistName, artistAlbums] of Object.entries(byArtist)) {
    console.log(`\n🎤 ${artistName} (${artistAlbums.length} albums)`);
    console.log('─'.repeat(50));
    
    // Group by decade
    const decades: Record<number, number> = {};
    let liveCount = 0;
    let studioCount = 0;
    
    for (const album of artistAlbums) {
      const year = new Date(album.releaseDate).getFullYear();
      const decade = Math.floor(year / 10) * 10;
      decades[decade] = (decades[decade] || 0) + 1;
      
      if (album.albumTitle.toLowerCase().includes('live')) {
        liveCount++;
      } else {
        studioCount++;
      }
    }
    
    // Show decade breakdown
    const decadeList = Object.entries(decades)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([decade, count]) => `${decade}s: ${count}`)
      .join(', ');
    
    console.log(`Decades: ${decadeList}`);
    console.log(`Types: ${studioCount} studio, ${liveCount} live`);
    
    // Show duplicate slugs
    const duplicates = artistAlbums.filter(a => a.albumSlug.match(/-\d+$/));
    if (duplicates.length > 0) {
      console.log(`Duplicate slugs handled: ${duplicates.length}`);
    }
  }
  
  // Overall stats
  console.log('\n\n📊 Overall Statistics');
  console.log('─'.repeat(50));
  console.log(`Total albums: ${allAlbums.length}`);
  console.log(`Total artists: ${Object.keys(byArtist).length}`);
  
  // Decade distribution
  const allDecades: Record<number, number> = {};
  for (const album of allAlbums) {
    const year = new Date(album.releaseDate).getFullYear();
    const decade = Math.floor(year / 10) * 10;
    allDecades[decade] = (allDecades[decade] || 0) + 1;
  }
  
  console.log('\nAlbums by decade:');
  for (const [decade, count] of Object.entries(allDecades).sort(([a], [b]) => Number(a) - Number(b))) {
    console.log(`  ${decade}s: ${count} albums`);
  }
  
  // All albums have Spotify IDs
  const withSpotify = allAlbums.filter(a => a.spotifyId).length;
  console.log(`\nSpotify coverage: ${withSpotify}/${allAlbums.length} (${Math.round(withSpotify/allAlbums.length * 100)}%)`);
}

albumSummary().catch(console.error);