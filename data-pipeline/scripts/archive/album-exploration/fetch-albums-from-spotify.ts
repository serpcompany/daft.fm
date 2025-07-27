#!/usr/bin/env tsx

import 'dotenv/config';

interface SpotifyAlbum {
  id: string;
  name: string;
  release_date: string;
  total_tracks: number;
  images: { url: string; height: number; width: number }[];
  external_urls: { spotify: string };
  album_type: string;
  artists: { id: string; name: string }[];
}

interface CanonicalAlbum {
  title: string;
  normalizedTitle: string;
  releaseDate: string;
  trackCount: number;
  coverArt: string | null;
  spotifyAlbumId: string;
  artistSpotifyId: string;
  artistName: string;
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

// Normalize album name to find duplicates
function normalizeAlbumName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '') // Remove (Remastered), (Deluxe), etc.
    .replace(/\s*\[[^\]]*\]/g, '') // Remove [Special Edition], etc.
    .replace(/\s*-\s*(remastered|deluxe|expanded|anniversary|edition).*/i, '') // Remove suffixes
    .trim();
}

// Check if album should be excluded
function shouldExcludeAlbum(name: string): boolean {
  const lowerName = name.toLowerCase();
  
  // Exclude obvious compilations and live albums if they're not the only version
  const excludePatterns = [
    'greatest hits',
    'best of',
    'collection',
    'anthology',
    'essential',
    'singles',
    'b-sides',
    'rarities',
    'unreleased',
    'demos',
    'outtakes'
  ];
  
  return excludePatterns.some(pattern => lowerName.includes(pattern));
}

// Fetch albums for an artist from Spotify
export async function fetchAlbumsFromSpotify(
  artistSpotifyId: string,
  artistName: string
): Promise<CanonicalAlbum[]> {
  const token = await getSpotifyToken();
  const allAlbums: SpotifyAlbum[] = [];
  let nextUrl: string | null = `https://api.spotify.com/v1/artists/${artistSpotifyId}/albums?include_groups=album&limit=50&market=US`;
  
  // Paginate through all albums
  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    allAlbums.push(...(data.items || []));
    nextUrl = data.next;
  }
  
  console.log(`  Found ${allAlbums.length} total albums`);
  
  // Filter out excluded albums
  const filteredAlbums = allAlbums.filter(album => !shouldExcludeAlbum(album.name));
  console.log(`  After filtering: ${filteredAlbums.length} albums`);
  
  // Group by normalized name to find duplicates
  const albumGroups: Record<string, SpotifyAlbum[]> = {};
  
  for (const album of filteredAlbums) {
    const normalized = normalizeAlbumName(album.name);
    
    if (!albumGroups[normalized]) {
      albumGroups[normalized] = [];
    }
    albumGroups[normalized].push(album);
  }
  
  // Select canonical version (earliest release date)
  const canonicalAlbums: CanonicalAlbum[] = [];
  
  for (const [normalizedTitle, versions] of Object.entries(albumGroups)) {
    // Sort by release date and take the earliest
    const canonical = versions.sort((a, b) => 
      a.release_date.localeCompare(b.release_date)
    )[0];
    
    if (versions.length > 1) {
      console.log(`  "${normalizedTitle}" has ${versions.length} versions, choosing: ${canonical.name} (${canonical.release_date})`);
    }
    
    canonicalAlbums.push({
      title: canonical.name,
      normalizedTitle,
      releaseDate: canonical.release_date,
      trackCount: canonical.total_tracks,
      coverArt: canonical.images?.[0]?.url || null,
      spotifyAlbumId: canonical.id,
      artistSpotifyId,
      artistName
    });
  }
  
  // Sort by release date
  canonicalAlbums.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  
  console.log(`  Final canonical albums: ${canonicalAlbums.length}`);
  
  return canonicalAlbums;
}

// Test with an artist
if (import.meta.url === `file://${process.argv[1]}`) {
  // Test with The Beatles
  const testArtistId = '3WrFJ7ztbogyGnTHbHJFl2';
  const testArtistName = 'The Beatles';
  
  console.log(`\nFetching albums for ${testArtistName}...`);
  
  fetchAlbumsFromSpotify(testArtistId, testArtistName)
    .then(albums => {
      console.log(`\nCanonical albums (${albums.length}):\n`);
      
      albums.forEach(album => {
        console.log(`${album.releaseDate} - ${album.title}`);
        console.log(`  Tracks: ${album.trackCount}`);
        console.log(`  Spotify ID: ${album.spotifyAlbumId}`);
        console.log(`  Cover: ${album.coverArt ? 'Yes' : 'No'}\n`);
      });
    })
    .catch(console.error);
}