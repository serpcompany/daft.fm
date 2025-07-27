#!/usr/bin/env tsx

import 'dotenv/config';

interface CanonicalAlbum {
  title: string;
  normalizedTitle: string;
  releaseDate: string;
  trackCount: number;
  coverArt: string | null;
  spotifyAlbumId: string;
  albumType: 'studio' | 'live' | 'compilation';
}

// Get Spotify access token
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

// Normalize album title for comparison
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '') // Remove all parenthetical content
    .replace(/\s*\[[^\]]*\]/g, '') // Remove all bracketed content
    .replace(/\s*-\s*.*(remaster|remix|deluxe|edition|anniversary).*/i, '') // Remove suffixes
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if album should be excluded
function isCanonicalStudioAlbum(album: any, artistName: string): boolean {
  const title = album.name.toLowerCase();
  
  // Exclude singles
  if (album.album_type === 'single') {
    return false;
  }
  
  // Exclude compilations
  if (album.album_type === 'compilation') {
    return false;
  }
  
  // Exclude live albums - be very strict
  const livePatterns = [
    'live at', 'live in', '(live)', '[live]', 'live from',
    'concert', 'tour', 'bootleg', 'broadcast', 'bbc',
    'stage', 'nashville', 'hollywood bowl', 'rooftop',
    'glastonbury', 'montreal', 'dallas', 'berlin'
  ];
  
  for (const pattern of livePatterns) {
    if (title.includes(pattern)) {
      return false;
    }
  }
  
  // Exclude soundtracks and special projects
  if (title.includes('soundtrack') || title.includes('narrates')) {
    return false;
  }
  
  // For Beatles, we need to be more lenient with remasters since that's all they have
  if (artistName === 'The Beatles') {
    // Accept remasters but not deluxe/anniversary editions
    const parenContent = title.match(/\([^)]*\)/g) || [];
    const bracketContent = title.match(/\[[^\]]*\]/g) || [];
    const allContent = [...parenContent, ...bracketContent].join(' ').toLowerCase();
    
    const excludePatterns = ['deluxe', 'anniversary', 'super', 'edition', '50th'];
    for (const pattern of excludePatterns) {
      if (allContent.includes(pattern)) {
        return false;
      }
    }
    
    // Accept if it's just "Remastered" or year remaster
    return true;
  }
  
  // For other artists, exclude most special editions
  const excludePatterns = [
    'remix', 'deluxe', 'edition', 'anniversary',
    'expanded', 'bonus', 'special', 'collector', 'legacy',
    'sessions', 'demos', 'outtakes', 'rarities',
    'b-sides', 'unreleased', 'alternate', 'anthology',
    'storytellers', 'mercury demos', 'deram anthology'
  ];
  
  // Check title directly
  for (const pattern of excludePatterns) {
    if (title.includes(pattern)) {
      return false;
    }
  }
  
  // Check parenthetical content for remasters (but allow year-only remasters like "2017 Remaster")
  const parenContent = title.match(/\([^)]*\)/g) || [];
  const bracketContent = title.match(/\[[^\]]*\]/g) || [];
  const allContent = [...parenContent, ...bracketContent].join(' ').toLowerCase();
  
  // If it has "remaster" with other words, exclude it
  if (allContent.includes('remaster') && allContent.match(/remaster.*\w+|\w+.*remaster/)) {
    return false;
  }
  
  return true;
}

export async function fetchCanonicalAlbums(
  artistSpotifyId: string,
  artistName: string
): Promise<CanonicalAlbum[]> {
  const token = await getSpotifyToken();
  const allAlbums: any[] = [];
  let nextUrl: string | null = `https://api.spotify.com/v1/artists/${artistSpotifyId}/albums?include_groups=album&limit=50&market=US`;
  
  // Fetch all albums
  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    allAlbums.push(...(data.items || []));
    nextUrl = data.next;
  }
  
  console.log(`  Raw albums from Spotify: ${allAlbums.length}`);
  
  // Filter to canonical studio albums only
  const studioAlbums = allAlbums.filter(album => isCanonicalStudioAlbum(album, artistName));
  console.log(`  After filtering to studio albums: ${studioAlbums.length}`);
  
  // Group by normalized title to handle duplicates
  const albumGroups: Record<string, any[]> = {};
  
  for (const album of studioAlbums) {
    const normalized = normalizeTitle(album.name);
    
    if (!albumGroups[normalized]) {
      albumGroups[normalized] = [];
    }
    albumGroups[normalized].push(album);
  }
  
  // For each group, pick the earliest release
  const canonicalAlbums: CanonicalAlbum[] = [];
  
  for (const [normalizedTitle, versions] of Object.entries(albumGroups)) {
    // Sort by release date, preferring full dates over year-only
    const sorted = versions.sort((a, b) => {
      // Prefer albums with full release dates
      if (a.release_date.length !== b.release_date.length) {
        return b.release_date.length - a.release_date.length;
      }
      return a.release_date.localeCompare(b.release_date);
    });
    
    const canonical = sorted[0];
    
    if (versions.length > 1) {
      console.log(`  "${normalizedTitle}": ${versions.length} versions, chose ${canonical.name} (${canonical.release_date})`);
    }
    
    canonicalAlbums.push({
      title: canonical.name,
      normalizedTitle,
      releaseDate: canonical.release_date,
      trackCount: canonical.total_tracks,
      coverArt: canonical.images?.[0]?.url || null,
      spotifyAlbumId: canonical.id,
      albumType: 'studio'
    });
  }
  
  // Sort by release date
  canonicalAlbums.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  
  console.log(`  Final canonical studio albums: ${canonicalAlbums.length}`);
  
  return canonicalAlbums;
}

// Test the function
if (import.meta.url === `file://${process.argv[1]}`) {
  async function test() {
    console.log('🎵 Testing Canonical Album Fetching\n');
    
    const artists = [
      { id: '3WrFJ7ztbogyGnTHbHJFl2', name: 'The Beatles' },
      { id: '0k17h0D3J5VfsdmQ1iZtE9', name: 'Pink Floyd' },
      { id: '0oSGxfWSnnOXhD2fKuz2Gy', name: 'David Bowie' }
    ];
    
    for (const artist of artists) {
      console.log(`\n🎤 ${artist.name}`);
      console.log('─'.repeat(60));
      
      const albums = await fetchCanonicalAlbums(artist.id, artist.name);
      
      console.log('\nCanonical Studio Albums:');
      for (const album of albums) {
        const year = album.releaseDate.substring(0, 4);
        console.log(`${year} - ${album.title}`);
      }
      
      // Compare to expected
      const expected: Record<string, number> = {
        'The Beatles': 13,
        'Pink Floyd': 15,
        'David Bowie': 28 // roughly, he has many studio albums
      };
      
      console.log(`\nExpected ~${expected[artist.name]} albums, got ${albums.length}`);
    }
  }
  
  test().catch(console.error);
}