#!/usr/bin/env tsx

import { stagingDb } from '../utils/staging-db';
import { artists, albums } from '../db/schema';
import { eq } from 'drizzle-orm';

async function viewAlbumsDetail() {
  console.log('💿 Album Details from Staging Database\n');
  
  // Get all artists
  const allArtists = await stagingDb
    .select()
    .from(artists)
    .all();
  
  for (const artist of allArtists) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎤 ${artist.name.toUpperCase()}`);
    console.log(`${'='.repeat(80)}`);
    
    // Get albums for this artist
    const artistAlbums = await stagingDb
      .select()
      .from(albums)
      .where(eq(albums.artistId, artist.id))
      .orderBy(albums.releaseDate)
      .all();
    
    console.log(`Total albums: ${artistAlbums.length}\n`);
    
    // Group by decade
    const decades: Record<string, typeof artistAlbums> = {};
    
    for (const album of artistAlbums) {
      const year = new Date(album.releaseDate).getFullYear();
      const decade = Math.floor(year / 10) * 10;
      const decadeKey = `${decade}s`;
      
      if (!decades[decadeKey]) {
        decades[decadeKey] = [];
      }
      decades[decadeKey].push(album);
    }
    
    // Display by decade
    for (const [decade, decadeAlbums] of Object.entries(decades).sort()) {
      console.log(`\n📅 ${decade} (${decadeAlbums.length} albums):`);
      console.log(`${'─'.repeat(60)}`);
      
      for (const album of decadeAlbums) {
        const releaseDate = new Date(album.releaseDate);
        const year = releaseDate.getFullYear();
        
        console.log(`\n${year} - ${album.title}`);
        console.log(`     Slug: ${album.slug}`);
        console.log(`     Tracks: ${album.trackCount}`);
        console.log(`     Spotify ID: ${album.spotifyAlbumId}`);
        
        // Check cover art
        if (album.coverArt) {
          const coverData = JSON.parse(album.coverArt);
          console.log(`     Cover Art: ${coverData.length > 0 ? '✅' : '❌'}`);
        }
        
        // Show if this is a live album or compilation
        const lowerTitle = album.title.toLowerCase();
        if (lowerTitle.includes('live') || lowerTitle.includes('(live)')) {
          console.log(`     📻 LIVE ALBUM`);
        }
        if (lowerTitle.includes('soundtrack')) {
          console.log(`     🎬 SOUNDTRACK`);
        }
      }
    }
  }
  
  // Overall statistics
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 OVERALL STATISTICS');
  console.log(`${'='.repeat(80)}`);
  
  const totalAlbums = await stagingDb.select().from(albums).all();
  
  // Albums by decade across all artists
  const allDecades: Record<string, number> = {};
  for (const album of totalAlbums) {
    const year = new Date(album.releaseDate).getFullYear();
    const decade = Math.floor(year / 10) * 10;
    const decadeKey = `${decade}s`;
    allDecades[decadeKey] = (allDecades[decadeKey] || 0) + 1;
  }
  
  console.log('\nAlbums by decade:');
  for (const [decade, count] of Object.entries(allDecades).sort()) {
    const bar = '█'.repeat(Math.round(count / 2));
    console.log(`${decade}: ${bar} ${count}`);
  }
  
  // Live vs Studio albums
  const liveAlbums = totalAlbums.filter(a => 
    a.title.toLowerCase().includes('live') || 
    a.title.toLowerCase().includes('(live)')
  ).length;
  
  console.log(`\nAlbum types:`);
  console.log(`- Studio albums: ${totalAlbums.length - liveAlbums}`);
  console.log(`- Live albums: ${liveAlbums}`);
  
  // Albums with duplicate slugs (handled)
  const duplicateSlugs = totalAlbums.filter(a => a.slug.match(/-\d+$/)).length;
  console.log(`\nDuplicate slugs handled: ${duplicateSlugs}`);
}

viewAlbumsDetail().catch(console.error);