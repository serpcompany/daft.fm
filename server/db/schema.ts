// Drizzle ORM schema for Cloudflare D1
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const artists = sqliteTable('artists', {
  id: text('id').primaryKey(), // MusicBrainz ID (UUID)
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  urlSlug: text('url_slug').notNull().unique(), // Ranked slug for URLs (e.g., "justice", "justice-2")
  country: text('country'),
  formedYear: integer('formed_year'),
  genres: text('genres'), // JSON array stored as text
  bio: text('bio'), // Nullable - from Discogs (high word count)
  images: text('images'), // Nullable - JSON array of image URLs from multiple sources
  wikidataId: text('wikidata_id'), // Key reconciliation identifier
  externalIds: text('external_ids'), // JSON object: {freebase_id, discogs_artist_id, spotify_id, etc.}
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const albums = sqliteTable('albums', {
  id: text('id').primaryKey(), // MusicBrainz Release Group ID (UUID)
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  artistId: text('artist_id').notNull().references(() => artists.id),
  releaseDate: integer('release_date', { mode: 'timestamp' }),
  trackCount: integer('track_count'),
  coverArt: text('cover_art'), // Nullable - JSON array of cover art URLs from multiple sources
  wikidataId: text('wikidata_id'), // Key reconciliation identifier
  externalIds: text('external_ids'), // JSON object: {freebase_id, discogs_master_id, spotify_album_id, etc.}
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const songs = sqliteTable('songs', {
  id: text('id').primaryKey(), // MusicBrainz Recording ID (UUID)
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  duration: integer('duration'), // Duration in seconds
  artistId: text('artist_id').notNull().references(() => artists.id),
  albumId: text('album_id').references(() => albums.id), // Optional - singles might not have album
  releaseDate: integer('release_date', { mode: 'timestamp' }),
  lyrics: text('lyrics'), // Nullable - from Genius API
  annotations: text('annotations'), // Nullable - from Genius API (high word count)
  isrc: text('isrc'), // Key reconciliation identifier for songs
  wikidataId: text('wikidata_id'), // Key reconciliation identifier
  externalIds: text('external_ids'), // JSON object: {freebase_id, genius_song_id, spotify_track_id, etc.}
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Define relations
export const artistsRelations = relations(artists, ({ many }) => ({
  albums: many(albums),
  songs: many(songs),
}));

export const albumsRelations = relations(albums, ({ one, many }) => ({
  artist: one(artists, {
    fields: [albums.artistId],
    references: [artists.id],
  }),
  songs: many(songs),
}));

export const songsRelations = relations(songs, ({ one }) => ({
  artist: one(artists, {
    fields: [songs.artistId],
    references: [artists.id],
  }),
  album: one(albums, {
    fields: [songs.albumId],
    references: [albums.id],
  }),
}));