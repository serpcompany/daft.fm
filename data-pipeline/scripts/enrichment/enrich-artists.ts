#!/usr/bin/env tsx

import { stagingDb } from '../utils/staging-db';
import { artists } from '../db/schema';
import { enrichArtist } from './enrich-orchestrator';
import { eq } from 'drizzle-orm';

async function enrichAllArtists() {
  console.log('🎨 Starting artist enrichment...\n');
  
  // Get all artists from staging
  const allArtists = await stagingDb
    .select()
    .from(artists)
    .all();
  
  console.log(`Found ${allArtists.length} artists to enrich\n`);
  
  let enrichedCount = 0;
  let errorCount = 0;
  
  for (const artist of allArtists) {
    console.log(`\n📊 Enriching: ${artist.name}`);
    console.log(`   IDs: MB=${artist.musicbrainzId}, Spotify=${artist.spotifyArtistId}, Discogs=${artist.discogsArtistId}`);
    
    try {
      // Skip if recently enriched (within 24 hours)
      if (artist.lastEnriched) {
        const hoursSinceEnrichment = (Date.now() - artist.lastEnriched.getTime()) / (1000 * 60 * 60);
        if (hoursSinceEnrichment < 24) {
          console.log(`   ⏭️  Skipping - enriched ${Math.round(hoursSinceEnrichment)} hours ago`);
          continue;
        }
      }
      
      // Enrich from all available sources
      const enrichmentData = await enrichArtist({
        name: artist.name,
        musicbrainzId: artist.musicbrainzId!,
        spotifyArtistId: artist.spotifyArtistId,
        discogsArtistId: artist.discogsArtistId,
        genres: artist.genres ? JSON.parse(artist.genres) : []
      });
      
      // Prepare update data
      const updateData = {
        bio: enrichmentData.bio,
        bioSummary: enrichmentData.bioSummary,
        images: JSON.stringify(enrichmentData.images),
        enrichedGenres: JSON.stringify(enrichmentData.genres),
        spotifyPopularity: enrichmentData.popularity,
        lastfmListeners: enrichmentData.stats.listeners,
        lastfmPlaycount: enrichmentData.stats.playcount,
        dataSourcesUsed: JSON.stringify(enrichmentData.dataSourcesUsed),
        lastEnriched: new Date(),
        updatedAt: new Date()
      };
      
      // Update artist in database
      await stagingDb
        .update(artists)
        .set(updateData)
        .where(eq(artists.id, artist.id));
      
      console.log(`   ✅ Enriched from: ${enrichmentData.dataSourcesUsed.join(', ')}`);
      console.log(`   📝 Bio: ${enrichmentData.bio ? enrichmentData.bio.substring(0, 50) + '...' : 'None'}`);
      console.log(`   🖼️  Images: Profile=${!!enrichmentData.images.profile}, Banner=${!!enrichmentData.images.banner}, Main=${!!enrichmentData.images.main}`);
      console.log(`   🎵 Genres: ${enrichmentData.genres.length} total`);
      console.log(`   📊 Stats: Popularity=${enrichmentData.popularity || 'N/A'}, Listeners=${enrichmentData.stats.listeners?.toLocaleString() || 'N/A'}`);
      
      enrichedCount++;
      
    } catch (error) {
      console.error(`   ❌ Error enriching ${artist.name}:`, error);
      errorCount++;
    }
  }
  
  console.log('\n\n🎉 Enrichment Complete!');
  console.log(`✅ Successfully enriched: ${enrichedCount} artists`);
  console.log(`❌ Errors: ${errorCount} artists`);
}

// Run enrichment
enrichAllArtists().catch(console.error);