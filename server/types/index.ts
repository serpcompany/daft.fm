// Re-export all types and schemas from schemas.ts
export * from './schemas';

// Additional utility types
import { z } from 'zod';
import { artistSchema, albumSchema, songSchema } from './schemas';

// Insert and Update schemas
import { createInsertSchema } from 'drizzle-zod';
import { artists, albums, songs } from '../db/schema';

export const insertArtistSchema = createInsertSchema(artists);
export const updateArtistSchema = insertArtistSchema.partial();

export const insertAlbumSchema = createInsertSchema(albums);
export const updateAlbumSchema = insertAlbumSchema.partial();

export const insertSongSchema = createInsertSchema(songs);
export const updateSongSchema = insertSongSchema.partial();

// Insert and Update types
export type InsertArtist = z.infer<typeof insertArtistSchema>;
export type UpdateArtist = z.infer<typeof updateArtistSchema>;

export type InsertAlbum = z.infer<typeof insertAlbumSchema>;
export type UpdateAlbum = z.infer<typeof updateAlbumSchema>;

export type InsertSong = z.infer<typeof insertSongSchema>;
export type UpdateSong = z.infer<typeof updateSongSchema>;

// Extended types with parsed JSON fields
export type ArtistWithParsedData = Omit<Artist, 'genres' | 'images' | 'externalIds'> & {
  genres?: string[];
  images?: string[];
  externalIds?: Record<string, string>;
};

export type AlbumWithParsedData = Omit<Album, 'coverArt' | 'externalIds'> & {
  coverArt?: string[];
  externalIds?: Record<string, string>;
};

export type SongWithParsedData = Omit<Song, 'externalIds'> & {
  externalIds?: Record<string, string>;
};