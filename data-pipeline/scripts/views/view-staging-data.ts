#!/usr/bin/env tsx

import { stagingDb } from '../utils/staging-db';
import { artists, albums } from '../db/schema';
import { eq } from 'drizzle-orm';

async function viewStagingData() {
  console.log('📊 Staging Database Overview\n');
  
  // Get all artists
  const allArtists = await stagingDb
    .select()
    .from(artists)
    .all();
  
  console.log(`Total artists: ${allArtists.length}\n`);
  
  for (const artist of allArtists) {
    console.log(`\n🎤 ${artist.name}`);
    console.log(`   ID: ${artist.id}`);
    console.log(`   MusicBrainz: ${artist.musicbrainzId}`);
    console.log(`   Spotify: ${artist.spotifyArtistId || 'N/A'}`);
    console.log(`   Popularity: ${artist.spotifyPopularity || 'N/A'}`);
    console.log(`   Listeners: ${artist.lastfmListeners?.toLocaleString() || 'N/A'}`);
    
    // Get albums for this artist
    const artistAlbums = await stagingDb
      .select()
      .from(albums)
      .where(eq(albums.artistId, artist.id))
      .orderBy(albums.releaseDate)
      .all();
    
    console.log(`\n   Albums (${artistAlbums.length}):`);
    
    for (const album of artistAlbums) {
      const releaseYear = new Date(album.releaseDate).getFullYear();
      console.log(`   - ${releaseYear}: ${album.title}`);
      
      // Show duplicate slug handling
      if (album.slug.match(/-\d+$/)) {
        console.log(`     ⚠️  Slug: ${album.slug} (duplicate handled)`);
      }
    }
  }
  
  // Summary stats
  const totalAlbums = await stagingDb
    .select()
    .from(albums)
    .all();
  
  console.log('\n\n📈 Summary Statistics:');
  console.log(`- Total artists: ${allArtists.length}`);
  console.log(`- Total albums: ${totalAlbums.length}`);
  console.log(`- Average albums per artist: ${(totalAlbums.length / allArtists.length).toFixed(1)}`);
  
  // Albums with Spotify IDs
  const albumsWithSpotify = totalAlbums.filter(a => a.spotifyAlbumId).length;
  console.log(`- Albums with Spotify IDs: ${albumsWithSpotify} (${((albumsWithSpotify / totalAlbums.length) * 100).toFixed(1)}%)`);
  
  // Check for potential enrichment opportunities
  console.log('\n🔍 Enrichment Opportunities:');
  const albumsWithoutMusicBrainz = totalAlbums.filter(a => !a.musicbrainzReleaseId).length;
  const albumsWithoutDiscogs = totalAlbums.filter(a => !a.discogsMasterId).length;
  
  console.log(`- Albums needing MusicBrainz matching: ${albumsWithoutMusicBrainz}`);
  console.log(`- Albums needing Discogs matching: ${albumsWithoutDiscogs}`);
}

viewStagingData().catch(console.error);