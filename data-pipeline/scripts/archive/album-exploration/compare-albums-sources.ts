#!/usr/bin/env tsx

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Create comparison schema
const albumComparison = sqliteTable('album_comparison', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  source: text('source').notNull(), // 'spotify' or 'discogs'
  artistName: text('artist_name').notNull(),
  albumTitle: text('album_title').notNull(),
  releaseYear: integer('release_year'),
  format: text('format'), // album type/format
  country: text('country'),
  trackCount: integer('track_count'),
  sourceId: text('source_id'), // spotify ID or discogs master ID
  genres: text('genres'),
  notes: text('notes') // for things like "Live", "Compilation", etc
});

// Create comparison database
const comparisonDb = new Database('album-comparison.db');
const db = drizzle(comparisonDb);

// Create table
comparisonDb.exec(`
  CREATE TABLE IF NOT EXISTS album_comparison (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    album_title TEXT NOT NULL,
    release_year INTEGER,
    format TEXT,
    country TEXT,
    track_count INTEGER,
    source_id TEXT,
    genres TEXT,
    notes TEXT
  )
`);

// Clear existing data
comparisonDb.exec('DELETE FROM album_comparison');

async function getSpotifyToken(): Promise<string> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET!
    })
  });
  const data = await response.json();
  return data.access_token;
}

async function fetchFromSpotify(artistId: string, artistName: string) {
  console.log(`\n📱 Fetching from Spotify for ${artistName}...`);
  
  const token = await getSpotifyToken();
  const allAlbums: any[] = [];
  let nextUrl: string | null = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album&limit=50&market=US`;
  
  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    allAlbums.push(...(data.items || []));
    nextUrl = data.next;
  }
  
  console.log(`Found ${allAlbums.length} albums`);
  
  // Insert into comparison table
  for (const album of allAlbums) {
    const year = album.release_date ? parseInt(album.release_date.substring(0, 4)) : null;
    
    // Determine notes
    const notes: string[] = [];
    const title = album.name.toLowerCase();
    if (title.includes('live')) notes.push('Live');
    if (title.includes('remaster')) notes.push('Remastered');
    if (title.includes('deluxe')) notes.push('Deluxe');
    if (title.includes('anniversary')) notes.push('Anniversary');
    if (album.album_type === 'compilation') notes.push('Compilation');
    
    await db.insert(albumComparison).values({
      source: 'spotify',
      artistName,
      albumTitle: album.name,
      releaseYear: year,
      format: album.album_type,
      country: 'US', // Spotify market
      trackCount: album.total_tracks,
      sourceId: album.id,
      genres: null, // Spotify doesn't provide genres in album list
      notes: notes.length > 0 ? notes.join(', ') : null
    });
  }
}

async function fetchFromDiscogs(artistName: string) {
  console.log(`\n💿 Fetching from Discogs for ${artistName}...`);
  
  const searchUrl = new URL('https://api.discogs.com/database/search');
  searchUrl.searchParams.append('artist', artistName);
  searchUrl.searchParams.append('type', 'master');
  searchUrl.searchParams.append('format', 'Album');
  searchUrl.searchParams.append('per_page', '100');
  searchUrl.searchParams.append('sort', 'year');
  searchUrl.searchParams.append('sort_order', 'asc');
  
  const response = await fetch(searchUrl.toString(), {
    headers: {
      'Authorization': `Discogs key=${process.env.DISCOGS_CONSUMER_KEY}, secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
      'User-Agent': 'DaftFmDataPipeline/1.0'
    }
  });
  
  const data = await response.json();
  console.log(`Found ${data.results?.length || 0} masters`);
  
  // Insert into comparison table
  for (const album of data.results || []) {
    // Extract clean album title (remove artist prefix)
    const albumTitle = album.title.includes(' - ') 
      ? album.title.split(' - ').slice(1).join(' - ')
      : album.title;
    
    // Determine notes
    const notes: string[] = [];
    const titleLower = albumTitle.toLowerCase();
    if (titleLower.includes('live')) notes.push('Live');
    if (titleLower.includes('unofficial')) notes.push('Unofficial');
    if (titleLower.includes('compilation')) notes.push('Compilation');
    if (album.format?.some((f: string) => f.includes('Compilation'))) notes.push('Compilation');
    
    await db.insert(albumComparison).values({
      source: 'discogs',
      artistName,
      albumTitle,
      releaseYear: album.year || null,
      format: album.format?.join(', ') || null,
      country: album.country || null,
      trackCount: null, // Not provided in search results
      sourceId: album.master_id || album.id,
      genres: album.genre?.join(', ') || null,
      notes: notes.length > 0 ? notes.join(', ') : null
    });
  }
  
  // Rate limit
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function compareAlbumSources() {
  console.log('🔍 Comparing Album Data from Spotify vs Discogs\n');
  
  const artists = [
    { name: 'The Beatles', spotifyId: '3WrFJ7ztbogyGnTHbHJFl2' },
    { name: 'Pink Floyd', spotifyId: '0k17h0D3J5VfsdmQ1iZtE9' },
    { name: 'David Bowie', spotifyId: '0oSGxfWSnnOXhD2fKuz2Gy' }
  ];
  
  // Fetch from both sources
  for (const artist of artists) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing ${artist.name}`);
    console.log('='.repeat(60));
    
    await fetchFromSpotify(artist.spotifyId, artist.name);
    await fetchFromDiscogs(artist.name);
  }
  
  // Show summary
  console.log('\n\n📊 SUMMARY COMPARISON:');
  console.log('─'.repeat(80));
  
  for (const artist of artists) {
    const spotifyCount = comparisonDb.prepare(
      'SELECT COUNT(*) as count FROM album_comparison WHERE source = ? AND artist_name = ?'
    ).get('spotify', artist.name) as any;
    
    const discogsCount = comparisonDb.prepare(
      'SELECT COUNT(*) as count FROM album_comparison WHERE source = ? AND artist_name = ?'
    ).get('discogs', artist.name) as any;
    
    console.log(`\n${artist.name}:`);
    console.log(`  Spotify: ${spotifyCount.count} albums`);
    console.log(`  Discogs: ${discogsCount.count} albums`);
  }
  
  // Show data quality analysis
  console.log('\n\n🔍 DATA QUALITY ANALYSIS:');
  console.log('─'.repeat(80));
  
  // Count albums with notes (live, remastered, etc)
  const spotifyWithNotes = comparisonDb.prepare(
    'SELECT COUNT(*) as count FROM album_comparison WHERE source = ? AND notes IS NOT NULL'
  ).get('spotify') as any;
  
  const discogsWithNotes = comparisonDb.prepare(
    'SELECT COUNT(*) as count FROM album_comparison WHERE source = ? AND notes IS NOT NULL'
  ).get('discogs') as any;
  
  console.log(`\nAlbums with notes (Live, Remastered, etc):`);
  console.log(`  Spotify: ${spotifyWithNotes.count} albums have notes`);
  console.log(`  Discogs: ${discogsWithNotes.count} albums have notes`);
  
  // Sample of clean vs problematic albums
  console.log('\n\nSAMPLE DATA - The Beatles "Abbey Road":');
  const abbeyRoad = comparisonDb.prepare(
    'SELECT * FROM album_comparison WHERE album_title LIKE ? ORDER BY source'
  ).all('%Abbey Road%');
  
  for (const album of abbeyRoad) {
    console.log(`\n${album.source.toUpperCase()}:`);
    console.log(`  Title: "${album.album_title}"`);
    console.log(`  Year: ${album.release_year}`);
    console.log(`  Format: ${album.format}`);
    console.log(`  Notes: ${album.notes || 'Clean'}`);
  }
  
  console.log('\n\n✅ Database saved to: album-comparison.db');
  console.log('You can now query this database to analyze the differences!');
}

compareAlbumSources().catch(console.error);