#!/usr/bin/env tsx

import { fetchArtistsByPopularity } from './fetch-artists-by-popularity';
import { stagingDb, initStagingDb } from './staging-db';
import { artists, artistMembers } from '../db/schema';
import { createSlug } from '../../server/lib/musicbrainz';
import { eq } from 'drizzle-orm';

async function saveArtistsToStaging() {
  const count = parseInt(process.argv[2]) || 3;
  console.log(`📊 Fetching ${count} artists to save to staging DB...\n`);
  
  try {
    // Initialize database if needed
    await initStagingDb();
    const fetchedArtists = await fetchArtistsByPopularity(count);
    
    let savedCount = 0;
    let skippedCount = 0;
    
    for (const artist of fetchedArtists) {
      // Check if artist already exists by MusicBrainz ID
      const existing = await stagingDb
        .select()
        .from(artists)
        .where(eq(artists.musicbrainzId, artist.musicbrainzArtistId))
        .get();
      
      if (existing) {
        console.log(`⏭️  Skipped: ${artist.name} (already exists)`);
        skippedCount++;
        continue;
      }
      
      // Prepare artist data matching new schema
      const artistData = {
        name: artist.name,
        slug: createSlug(artist.name),
        urlSlug: createSlug(artist.name), // TODO: Handle duplicates
        country: artist.country,
        formedYear: artist.formedYear,
        genres: artist.genres.length > 0 ? JSON.stringify(artist.genres) : null,
        members: JSON.stringify(artist.members), // Temporary until we save to artist_members
        bio: null, // Will be enriched later
        images: null, // Will be enriched later
        musicbrainzId: artist.musicbrainzArtistId,
        wikidataId: artist.wikidataEntityId,
        discogsArtistId: artist.discogsArtistId,
        spotifyArtistId: artist.spotifyArtistId,
        lastfmUrl: artist.lastfmUrl,
        isni: artist.isni,
        externalIds: JSON.stringify(artist.externalIds),
        twitter: artist.externalIds.twitter,
        instagram: artist.externalIds.instagram,
        facebook: artist.externalIds.facebook,
        youtubeChannelId: artist.externalIds.youtubeChannelId,
        popularityScore: artist.popularityScore,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Insert artist
      const insertResult = await stagingDb.insert(artists).values(artistData).returning();
      const insertedArtist = insertResult[0];
      savedCount++;
      
      console.log(`✓ Saved: ${artist.name} (ID: ${insertedArtist.id})`);
      
      // Save members to artist_members table
      if (artist.members.length > 0) {
        for (const member of artist.members) {
          await stagingDb.insert(artistMembers).values({
            artistId: insertedArtist.id,
            memberName: member.name,
            memberMbid: member.mbid,
            instruments: member.instruments,
            beginDate: member.beginDate,
            endDate: member.endDate,
            isOriginalMember: member.instruments?.includes('original'),
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
        console.log(`  └─ Saved ${artist.members.length} members`);
      }
    }
    
    console.log(`\n✅ Saved ${savedCount} new artists to staging`);
    console.log(`⏭️  Skipped ${skippedCount} existing artists`);
    
    // Show current totals
    const allArtists = await stagingDb.select().from(artists).all();
    console.log(`📊 Total artists in staging: ${allArtists.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
saveArtistsToStaging();