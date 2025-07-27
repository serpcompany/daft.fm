// Database seeding script for development
import { createDb } from '../server/db';
import { artists, albums, songs } from '../server/db/schema';
import { insertArtistSchema, insertAlbumSchema, insertSongSchema } from '../server/types';
import { getArtist, getArtistReleaseGroups, getArtistRecordings, createSlug } from '../server/lib/musicbrainz';

// Well-known artist MBIDs for seeding
const SEED_ARTISTS = [
  { mbid: '056e4f3e-d505-4dad-8ec1-d04f521cbb56', name: 'Daft Punk' },
  { mbid: 'f54ba20c-aa3b-443e-a97e-6bee0329b0dd', name: 'Justice' },
  { mbid: '6f70bfbe-f3b3-4985-8074-d3a67aad0e8b', name: 'Moderat' }
];

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  
  // For development, we'll create a simple D1 mock
  // In actual Nuxt context, this would come from the runtime
  const mockD1 = {
    prepare: (sql: string) => ({
      bind: (...params: any[]) => ({
        all: async () => ({ results: [] }),
        first: async () => null,
        run: async () => ({ success: true })
      }),
      all: async () => ({ results: [] }),
      first: async () => null,
      run: async () => ({ success: true })
    }),
    exec: async (sql: string) => ({ results: [] })
  } as unknown as D1Database;
  
  const db = createDb(mockD1);
  
  for (const seedArtist of SEED_ARTISTS) {
    try {
      console.log(`\n📀 Processing ${seedArtist.name}...`);
      
      // 1. Fetch artist data
      const mbArtist = await getArtist(seedArtist.mbid, ['tags', 'genres']);
      
      const artistData = insertArtistSchema.parse({
        id: mbArtist.id,
        name: mbArtist.name,
        slug: createSlug(mbArtist.name),
        country: mbArtist.country || null,
        formedYear: mbArtist['life-span']?.begin ? 
          parseInt(mbArtist['life-span'].begin.split('-')[0]) : null,
        genres: JSON.stringify(mbArtist.tags?.map(tag => tag.name) || []),
        bio: null, // Will add from other sources later
        images: null, // Will add from other sources later
        wikidataId: null, // Will add from relations later
        externalIds: JSON.stringify({}),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`  ✅ Artist: ${artistData.name}`);
      // await db.insert(artists).values(artistData);
      
      // 2. Fetch and insert release groups (albums)
      const releaseGroups = await getArtistReleaseGroups(seedArtist.mbid, 10);
      
      for (const rg of releaseGroups['release-groups'].slice(0, 3)) { // Limit to 3 albums
        const albumData = insertAlbumSchema.parse({
          id: rg.id,
          title: rg.title,
          slug: createSlug(rg.title),
          artistId: mbArtist.id,
          releaseDate: rg['first-release-date'] ? new Date(rg['first-release-date']) : null,
          trackCount: null, // Would need to fetch releases to get track count
          coverArt: null, // Will add from other sources later
          wikidataId: null,
          externalIds: JSON.stringify({}),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`    💿 Album: ${albumData.title}`);
        // await db.insert(albums).values(albumData);
      }
      
      // 3. Fetch and insert recordings (songs)
      const recordings = await getArtistRecordings(seedArtist.mbid, 15);
      
      for (const recording of recordings.recordings.slice(0, 5)) { // Limit to 5 songs
        const songData = insertSongSchema.parse({
          id: recording.id,
          title: recording.title,
          slug: createSlug(recording.title),
          duration: recording.length ? Math.floor(recording.length / 1000) : null,
          artistId: mbArtist.id,
          albumId: null, // Would need to match with release groups
          releaseDate: null, // Would get from release data
          lyrics: null, // Will add from Genius later
          annotations: null, // Will add from Genius later
          isrc: null, // Would get from recording relations
          wikidataId: null,
          externalIds: JSON.stringify({}),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`      🎵 Song: ${songData.title}`);
        // await db.insert(songs).values(songData);
      }
      
      // Rate limiting - wait between artists
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Error processing ${seedArtist.name}:`, error);
    }
  }
  
  console.log('\n🎉 Database seeding completed!');
}

// Reset database (for development)
async function resetDatabase() {
  console.log('🗑️  Resetting database...');
  
  // This would delete all data - use with caution!
  // await db.delete(songs);
  // await db.delete(albums);
  // await db.delete(artists);
  
  console.log('✅ Database reset completed!');
}

// Run seeding
if (import.meta.main) {
  seedDatabase().catch(console.error);
}

export { seedDatabase, resetDatabase };