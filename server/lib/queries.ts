// Database query utilities for daft.fm
import { eq, desc, asc, like } from 'drizzle-orm';
import { createDb, type Database } from '../db/db';
import { artists, albums, songs } from '../db/schema';
import type { Artist, Album, Song, AlbumWithArtist, SongWithDetails, ArtistWithStats } from '../types';
import { isValidMbid } from './urls';

/**
 * Get D1 database instance from Nuxt context
 * Works with both local development (Wrangler) and production (Cloudflare)
 */
export function getDatabase(event?: any): Database | null {
  try {
    // In production, get from Cloudflare environment
    if (event?.context?.cloudflare?.env?.DB) {
      return createDb(event.context.cloudflare.env.DB);
    }
    
    // For development, we'll need to handle this differently
    // This is a placeholder - will be updated when we integrate with Nuxt runtime
    console.warn('Database not available - ensure D1 binding is configured');
    return null;
  } catch (error) {
    console.error('Failed to get database instance:', error);
    return null;
  }
}

// Artists
export async function getArtistByMbid(db: Database, mbid: string): Promise<Artist | null> {
  if (!isValidMbid(mbid)) return null;
  
  try {
    const result = await db.select().from(artists).where(eq(artists.id, mbid)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error fetching artist:', error);
    return null;
  }
}

export async function getArtistBySlug(db: Database, slug: string): Promise<Artist | null> {
  try {
    const result = await db.select().from(artists).where(eq(artists.slug, slug)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error fetching artist by slug:', error);
    return null;
  }
}

export async function getArtistByUrlSlug(db: Database, urlSlug: string): Promise<Artist | null> {
  try {
    const result = await db.select().from(artists).where(eq(artists.urlSlug, urlSlug)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error fetching artist by URL slug:', error);
    return null;
  }
}

export async function getArtists(db: Database, limit = 50, offset = 0): Promise<Artist[]> {
  try {
    return await db.select().from(artists).orderBy(asc(artists.name)).limit(limit).offset(offset);
  } catch (error) {
    console.error('Error fetching artists:', error);
    return [];
  }
}

export async function getAllArtists(db: Database, limit = 50): Promise<Artist[]> {
  return getArtists(db, limit, 0);
}

export async function getArtistWithStats(db: Database, mbid: string): Promise<ArtistWithStats | null> {
  const artist = await getArtistByMbid(db, mbid);
  if (!artist) return null;
  
  try {
    const [artistAlbums, artistSongs] = await Promise.all([
      db.select().from(albums).where(eq(albums.artistId, mbid)),
      db.select().from(songs).where(eq(songs.artistId, mbid))
    ]);
    
    return {
      artist,
      albumCount: artistAlbums.length,
      songCount: artistSongs.length
    };
  } catch (error) {
    console.error('Error fetching artist stats:', error);
    return { artist, albumCount: 0, songCount: 0 };
  }
}

// Albums
export async function getAlbumByMbid(db: Database, mbid: string): Promise<Album | null> {
  if (!isValidMbid(mbid)) return null;
  
  try {
    const result = await db.select().from(albums).where(eq(albums.id, mbid)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error fetching album:', error);
    return null;
  }
}

export async function getAlbums(db: Database, limit = 50, offset = 0): Promise<Album[]> {
  try {
    return await db.select().from(albums).orderBy(desc(albums.releaseDate)).limit(limit).offset(offset);
  } catch (error) {
    console.error('Error fetching albums:', error);
    return [];
  }
}

export async function getAlbumsWithArtists(db: Database, limit = 50, offset = 0): Promise<AlbumWithArtist[]> {
  try {
    return await db.select({
      id: albums.id,
      title: albums.title,
      slug: albums.slug,
      artistId: albums.artistId,
      releaseDate: albums.releaseDate,
      trackCount: albums.trackCount,
      coverArt: albums.coverArt,
      wikidataId: albums.wikidataId,
      externalIds: albums.externalIds,
      createdAt: albums.createdAt,
      updatedAt: albums.updatedAt,
      artistName: artists.name,
      artistSlug: artists.slug
    })
    .from(albums)
    .leftJoin(artists, eq(albums.artistId, artists.id))
    .orderBy(desc(albums.releaseDate))
    .limit(limit)
    .offset(offset);
  } catch (error) {
    console.error('Error fetching albums with artists:', error);
    return [];
  }
}

export async function getAllAlbums(db: Database, limit = 50): Promise<Album[]> {
  return getAlbums(db, limit, 0);
}

export async function getAlbumsByArtist(db: Database, artistMbid: string, limit = 50, offset = 0): Promise<Album[]> {
  if (!isValidMbid(artistMbid)) return [];
  
  try {
    return await db.select().from(albums)
      .where(eq(albums.artistId, artistMbid))
      .orderBy(desc(albums.releaseDate))
      .limit(limit)
      .offset(offset);
  } catch (error) {
    console.error('Error fetching artist albums:', error);
    return [];
  }
}

export async function getAlbumWithArtist(db: Database, mbid: string): Promise<{
  album: Album;
  artist: Artist;
} | null> {
  const album = await getAlbumByMbid(db, mbid);
  if (!album) return null;
  
  const artist = await getArtistByMbid(db, album.artistId);
  if (!artist) return null;
  
  return { album, artist };
}

export async function getAlbumWithSongs(db: Database, mbid: string): Promise<{
  album: Album;
  artist: Artist;
  songs: Song[];
} | null> {
  const albumData = await getAlbumWithArtist(db, mbid);
  if (!albumData) return null;
  
  try {
    const albumSongs = await db.select().from(songs)
      .where(eq(songs.albumId, mbid))
      .orderBy(asc(songs.title)); // TODO: Add track number when available
    
    return {
      ...albumData,
      songs: albumSongs
    };
  } catch (error) {
    console.error('Error fetching album songs:', error);
    return {
      ...albumData,
      songs: []
    };
  }
}

export async function getArtistAlbums(db: Database, artistMbid: string): Promise<Album[]> {
  if (!isValidMbid(artistMbid)) return [];
  
  try {
    return await db.select().from(albums)
      .where(eq(albums.artistId, artistMbid))
      .orderBy(desc(albums.releaseDate));
  } catch (error) {
    console.error('Error fetching artist albums:', error);
    return [];
  }
}

// Songs
export async function getSongByMbid(db: Database, mbid: string): Promise<Song | null> {
  if (!isValidMbid(mbid)) return null;
  
  try {
    const result = await db.select().from(songs).where(eq(songs.id, mbid)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error fetching song:', error);
    return null;
  }
}

export async function getSongs(db: Database, limit = 50, offset = 0): Promise<Song[]> {
  try {
    return await db.select().from(songs).orderBy(asc(songs.title)).limit(limit).offset(offset);
  } catch (error) {
    console.error('Error fetching songs:', error);
    return [];
  }
}

export async function getSongsWithArtists(db: Database, limit = 50, offset = 0): Promise<SongWithDetails[]> {
  try {
    return await db.select({
      id: songs.id,
      title: songs.title,
      slug: songs.slug,
      duration: songs.duration,
      artistId: songs.artistId,
      albumId: songs.albumId,
      releaseDate: songs.releaseDate,
      lyrics: songs.lyrics,
      annotations: songs.annotations,
      isrc: songs.isrc,
      wikidataId: songs.wikidataId,
      externalIds: songs.externalIds,
      createdAt: songs.createdAt,
      updatedAt: songs.updatedAt,
      artistName: artists.name,
      artistSlug: artists.slug,
      albumTitle: albums.title,
      albumSlug: albums.slug
    })
    .from(songs)
    .leftJoin(artists, eq(songs.artistId, artists.id))
    .leftJoin(albums, eq(songs.albumId, albums.id))
    .orderBy(asc(songs.title))
    .limit(limit)
    .offset(offset);
  } catch (error) {
    console.error('Error fetching songs with artists:', error);
    return [];
  }
}

export async function getAllSongs(db: Database, limit = 50): Promise<Song[]> {
  return getSongs(db, limit, 0);
}

export async function getSongsByArtist(db: Database, artistMbid: string, limit = 50, offset = 0): Promise<Song[]> {
  if (!isValidMbid(artistMbid)) return [];
  
  try {
    return await db.select().from(songs)
      .where(eq(songs.artistId, artistMbid))
      .orderBy(asc(songs.title))
      .limit(limit)
      .offset(offset);
  } catch (error) {
    console.error('Error fetching artist songs:', error);
    return [];
  }
}

export async function getSongsByAlbum(db: Database, albumMbid: string, limit = 50, offset = 0): Promise<Song[]> {
  if (!isValidMbid(albumMbid)) return [];
  
  try {
    return await db.select().from(songs)
      .where(eq(songs.albumId, albumMbid))
      .orderBy(asc(songs.title))
      .limit(limit)
      .offset(offset);
  } catch (error) {
    console.error('Error fetching album songs:', error);
    return [];
  }
}

export async function getSongWithDetails(db: Database, mbid: string): Promise<{
  song: Song;
  artist: Artist;
  album?: Album;
} | null> {
  const song = await getSongByMbid(db, mbid);
  if (!song) return null;
  
  const artist = await getArtistByMbid(db, song.artistId);
  if (!artist) return null;
  
  let album: Album | undefined;
  if (song.albumId) {
    album = await getAlbumByMbid(db, song.albumId) || undefined;
  }
  
  return { song, artist, album };
}

export async function getArtistSongs(db: Database, artistMbid: string): Promise<Song[]> {
  if (!isValidMbid(artistMbid)) return [];
  
  try {
    return await db.select().from(songs)
      .where(eq(songs.artistId, artistMbid))
      .orderBy(asc(songs.title));
  } catch (error) {
    console.error('Error fetching artist songs:', error);
    return [];
  }
}

// Search functionality
export async function searchArtists(db: Database, query: string, limit = 20, offset = 0): Promise<Artist[]> {
  if (!query.trim()) return [];
  
  try {
    const searchTerm = `%${query.toLowerCase()}%`;
    return await db.select().from(artists)
      .where(like(artists.name, searchTerm))
      .orderBy(asc(artists.name))
      .limit(limit)
      .offset(offset);
  } catch (error) {
    console.error('Error searching artists:', error);
    return [];
  }
}

export async function searchAlbums(db: Database, query: string, limit = 20, offset = 0): Promise<Album[]> {
  if (!query.trim()) return [];
  
  try {
    const searchTerm = `%${query.toLowerCase()}%`;
    return await db.select().from(albums)
      .where(like(albums.title, searchTerm))
      .orderBy(desc(albums.releaseDate))
      .limit(limit)
      .offset(offset);
  } catch (error) {
    console.error('Error searching albums:', error);
    return [];
  }
}

export async function searchSongs(db: Database, query: string, limit = 20, offset = 0): Promise<Song[]> {
  if (!query.trim()) return [];
  
  try {
    const searchTerm = `%${query.toLowerCase()}%`;
    return await db.select().from(songs)
      .where(like(songs.title, searchTerm))
      .orderBy(asc(songs.title))
      .limit(limit)
      .offset(offset);
  } catch (error) {
    console.error('Error searching songs:', error);
    return [];
  }
}