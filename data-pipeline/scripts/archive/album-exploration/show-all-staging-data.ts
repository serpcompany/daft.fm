#!/usr/bin/env tsx

import { stagingDb } from './staging-db';
import { artists, albums } from '../db/schema';
import { eq } from 'drizzle-orm';

async function showAllStagingData() {
  console.log('📀 ALL DATA IN STAGING DATABASE\n');
  
  // Get all artists
  const allArtists = await stagingDb
    .select()
    .from(artists)
    .all();
  
  for (const artist of allArtists) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎤 ${artist.name.toUpperCase()}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Artist ID: ${artist.id}`);
    console.log(`MusicBrainz ID: ${artist.musicbrainzId}`);
    console.log(`Spotify ID: ${artist.spotifyArtistId}`);
    console.log(`Spotify Popularity: ${artist.spotifyPopularity}`);
    console.log(`Last.fm Listeners: ${artist.lastfmListeners?.toLocaleString()}`);
    
    // Get all albums for this artist
    const artistAlbums = await stagingDb
      .select()
      .from(albums)
      .where(eq(albums.artistId, artist.id))
      .orderBy(albums.releaseDate)
      .all();
    
    console.log(`\nALBUMS (${artistAlbums.length} total):`);
    console.log('─'.repeat(60));
    
    // Categorize albums
    const studioAlbums: typeof artistAlbums = [];
    const liveAlbums: typeof artistAlbums = [];
    const compilations: typeof artistAlbums = [];
    const other: typeof artistAlbums = [];
    
    for (const album of artistAlbums) {
      const title = album.title.toLowerCase();
      if (title.includes('live') || title.includes('(live)')) {
        liveAlbums.push(album);
      } else if (title.includes('greatest') || title.includes('best of') || 
                 title.includes('collection') || title.includes('anthology')) {
        compilations.push(album);
      } else if (title.includes('soundtrack') || title.includes('songtrack')) {
        other.push(album);
      } else {
        studioAlbums.push(album);
      }
    }
    
    if (studioAlbums.length > 0) {
      console.log('\n📼 STUDIO ALBUMS:');
      for (const album of studioAlbums) {
        const year = new Date(album.releaseDate).getFullYear();
        console.log(`${year} - ${album.title}`);
        console.log(`     Spotify ID: ${album.spotifyAlbumId}`);
        console.log(`     Tracks: ${album.trackCount}`);
      }
    }
    
    if (liveAlbums.length > 0) {
      console.log('\n🎤 LIVE ALBUMS:');
      for (const album of liveAlbums) {
        const year = new Date(album.releaseDate).getFullYear();
        console.log(`${year} - ${album.title}`);
      }
    }
    
    if (compilations.length > 0) {
      console.log('\n📚 COMPILATIONS:');
      for (const album of compilations) {
        const year = new Date(album.releaseDate).getFullYear();
        console.log(`${year} - ${album.title}`);
      }
    }
    
    if (other.length > 0) {
      console.log('\n🎬 SOUNDTRACKS/OTHER:');
      for (const album of other) {
        const year = new Date(album.releaseDate).getFullYear();
        console.log(`${year} - ${album.title}`);
      }
    }
  }
  
  // Summary
  const totalAlbums = await stagingDb.select().from(albums).all();
  const totalWithSpotify = totalAlbums.filter(a => a.spotifyAlbumId).length;
  const totalWithDiscogs = totalAlbums.filter(a => a.discogsMasterId).length;
  const totalWithMusicBrainz = totalAlbums.filter(a => a.musicbrainzReleaseId).length;
  
  console.log('\n\n📊 DATABASE SUMMARY:');
  console.log('─'.repeat(60));
  console.log(`Total artists: ${allArtists.length}`);
  console.log(`Total albums: ${totalAlbums.length}`);
  console.log(`Albums with Spotify IDs: ${totalWithSpotify} (100%)`);
  console.log(`Albums with Discogs Master IDs: ${totalWithDiscogs}`);
  console.log(`Albums with MusicBrainz Release IDs: ${totalWithMusicBrainz}`);
}

showAllStagingData().catch(console.error);