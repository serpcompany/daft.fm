#!/usr/bin/env tsx

import { stagingDb } from './staging-db';
import { artists, albums } from '../db/schema';
import { eq } from 'drizzle-orm';
import { fetchAlbumsFromSpotify } from './fetch-albums-from-spotify';

function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function createUniqueSlug(baseSlug: string, artistId: number): Promise<string> {
  // Check if slug already exists
  const existing = await stagingDb
    .select()
    .from(albums)
    .where(eq(albums.slug, baseSlug))
    .all();
  
  if (existing.length === 0) {
    return baseSlug;
  }
  
  // Find a unique slug by appending numbers
  let counter = 2;
  while (true) {
    const newSlug = `${baseSlug}-${counter}`;
    const existingWithCounter = await stagingDb
      .select()
      .from(albums)
      .where(eq(albums.slug, newSlug))
      .all();
    
    if (existingWithCounter.length === 0) {
      return newSlug;
    }
    counter++;
  }
}

async function saveAlbumsToStaging() {
  console.log('💿 Fetching albums for all artists in staging...\n');
  
  // Get all artists from staging
  const allArtists = await stagingDb
    .select()
    .from(artists)
    .all();
  
  console.log(`Found ${allArtists.length} artists in staging\n`);
  
  let totalAlbumsSaved = 0;
  let totalAlbumsSkipped = 0;
  
  for (const artist of allArtists) {
    console.log(`\n🎤 Processing ${artist.name}...`);
    
    if (!artist.spotifyArtistId) {
      console.log('  ❌ No Spotify ID, skipping');
      continue;
    }
    
    try {
      // Fetch albums from Spotify
      const spotifyAlbums = await fetchAlbumsFromSpotify(
        artist.spotifyArtistId,
        artist.name
      );
      
      // Save each album
      for (const album of spotifyAlbums) {
        // Check if album already exists
        const existing = await stagingDb
          .select()
          .from(albums)
          .where(eq(albums.spotifyAlbumId, album.spotifyAlbumId))
          .limit(1)
          .all();
        
        if (existing.length > 0) {
          console.log(`  ⏭️  Skipping "${album.title}" - already exists`);
          totalAlbumsSkipped++;
          continue;
        }
        
        // Prepare album data
        const baseSlug = createSlug(album.normalizedTitle);
        const uniqueSlug = await createUniqueSlug(baseSlug, artist.id);
        
        const albumData = {
          title: album.title,
          slug: uniqueSlug,
          artistId: artist.id,
          releaseDate: new Date(album.releaseDate),
          trackCount: album.trackCount,
          genres: null, // Will be enriched later
          coverArt: JSON.stringify([{
            url: album.coverArt,
            width: 640,
            height: 640,
            source: 'spotify'
          }]),
          credits: null, // Will be enriched later
          
          // Entity resolution IDs
          musicbrainzReleaseId: null, // Will match later
          wikidataId: null,
          discogsMasterId: null, // Will match later
          discogsReleaseId: null,
          spotifyAlbumId: album.spotifyAlbumId,
          barcode: null,
          catalogNumber: null,
          externalIds: JSON.stringify({
            spotifyAlbumId: album.spotifyAlbumId
          }),
          
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Insert album
        await stagingDb.insert(albums).values(albumData);
        
        console.log(`  ✅ Saved "${album.title}" (${album.releaseDate})`);
        totalAlbumsSaved++;
      }
      
      // Rate limit between artists
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`  ❌ Error processing ${artist.name}:`, error);
    }
  }
  
  // Summary
  console.log('\n\n📊 Summary:');
  console.log(`✅ Albums saved: ${totalAlbumsSaved}`);
  console.log(`⏭️  Albums skipped: ${totalAlbumsSkipped}`);
  
  // Show total albums in database
  const totalAlbums = await stagingDb
    .select({ count: albums.id })
    .from(albums)
    .all();
  
  console.log(`💿 Total albums in staging: ${totalAlbums.length}`);
}

// Run the script
saveAlbumsToStaging().catch(console.error);