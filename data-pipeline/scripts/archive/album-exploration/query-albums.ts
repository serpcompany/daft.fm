#!/usr/bin/env tsx

import { stagingDb } from './staging-db';
import { artists, albums } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

async function queryAlbums() {
  // Query 1: Album count by artist
  console.log('📊 Album Count by Artist:');
  console.log('------------------------');
  
  const albumCounts = await stagingDb
    .select({
      artistName: artists.name,
      albumCount: sql<number>`count(${albums.id})`,
      earliestRelease: sql<string>`min(${albums.releaseDate})`,
      latestRelease: sql<string>`max(${albums.releaseDate})`
    })
    .from(albums)
    .leftJoin(artists, eq(albums.artistId, artists.id))
    .groupBy(artists.name)
    .all();
  
  for (const row of albumCounts) {
    const earliestYear = new Date(row.earliestRelease).getFullYear();
    const latestYear = new Date(row.latestRelease).getFullYear();
    console.log(`${row.artistName}: ${row.albumCount} albums (${earliestYear}-${latestYear})`);
  }
  
  // Query 2: Albums with duplicate slugs
  console.log('\n🔄 Albums with Handled Duplicate Slugs:');
  console.log('--------------------------------------');
  
  const duplicateSlugs = await stagingDb
    .select({
      title: albums.title,
      slug: albums.slug,
      artistName: artists.name
    })
    .from(albums)
    .leftJoin(artists, eq(albums.artistId, artists.id))
    .where(sql`${albums.slug} LIKE '%-_'`)
    .all();
  
  for (const album of duplicateSlugs) {
    console.log(`- "${album.title}" → ${album.slug} (${album.artistName})`);
  }
  
  // Query 3: Live albums
  console.log('\n🎤 Live Albums:');
  console.log('-------------');
  
  const liveAlbums = await stagingDb
    .select({
      title: albums.title,
      releaseDate: albums.releaseDate,
      artistName: artists.name
    })
    .from(albums)
    .leftJoin(artists, eq(albums.artistId, artists.id))
    .where(sql`lower(${albums.title}) LIKE '%live%'`)
    .orderBy(albums.releaseDate)
    .all();
  
  for (const album of liveAlbums) {
    const year = new Date(album.releaseDate).getFullYear();
    console.log(`${year} - ${album.title} (${album.artistName})`);
  }
  
  // Query 4: Albums by decade
  console.log('\n📅 Albums by Decade:');
  console.log('------------------');
  
  const decadeCounts = await stagingDb
    .select({
      decade: sql<string>`substr(${albums.releaseDate}, 1, 3) || '0s'`,
      count: sql<number>`count(*)`
    })
    .from(albums)
    .groupBy(sql`substr(${albums.releaseDate}, 1, 3)`)
    .orderBy(sql`substr(${albums.releaseDate}, 1, 3)`)
    .all();
  
  for (const row of decadeCounts) {
    const bar = '█'.repeat(Math.min(row.count, 40));
    console.log(`${row.decade}: ${bar} ${row.count}`);
  }
  
  // Query 5: Random sample of albums
  console.log('\n🎲 Random Sample (5 albums):');
  console.log('--------------------------');
  
  const randomAlbums = await stagingDb
    .select({
      title: albums.title,
      artistName: artists.name,
      releaseDate: albums.releaseDate,
      trackCount: albums.trackCount
    })
    .from(albums)
    .leftJoin(artists, eq(albums.artistId, artists.id))
    .orderBy(sql`RANDOM()`)
    .limit(5)
    .all();
  
  for (const album of randomAlbums) {
    const year = new Date(album.releaseDate).getFullYear();
    console.log(`- ${album.title} by ${album.artistName} (${year}, ${album.trackCount} tracks)`);
  }
  
  // Summary
  const total = await stagingDb.select({ count: sql<number>`count(*)` }).from(albums).get();
  console.log(`\n📈 Total albums in database: ${total?.count}`);
}

queryAlbums().catch(console.error);