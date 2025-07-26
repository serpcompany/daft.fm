// Data pipeline staging schema - separate from main app
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Artists with proper auto-increment PK
export const artists = sqliteTable('artists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  urlSlug: text('url_slug').notNull().unique(),
  country: text('country'),
  formedYear: integer('formed_year'),
  genres: text('genres'), // JSON array
  members: text('members'), // JSON array (temporary)
  bio: text('bio'),
  images: text('images'), // JSON array
  
  // Entity resolution IDs
  musicbrainzId: text('musicbrainz_id').unique(),
  wikidataId: text('wikidata_id'),
  discogsArtistId: text('discogs_artist_id'),
  spotifyArtistId: text('spotify_artist_id'),
  lastfmUrl: text('lastfm_url'),
  isni: text('isni'),
  externalIds: text('external_ids'), // JSON object for additional IDs
  
  // Social media
  twitter: text('twitter'),
  instagram: text('instagram'),
  facebook: text('facebook'),
  youtubeChannelId: text('youtube_channel_id'),
  
  // Metadata
  popularityScore: integer('popularity_score'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Albums with proper FK to our artist ID
export const albums = sqliteTable('albums', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  artistId: integer('artist_id').notNull().references(() => artists.id),
  releaseDate: integer('release_date', { mode: 'timestamp' }),
  trackCount: integer('track_count'),
  genres: text('genres'), // JSON array
  coverArt: text('cover_art'), // JSON array
  credits: text('credits'), // JSON object
  
  // Entity resolution IDs
  musicbrainzReleaseId: text('musicbrainz_release_id').unique(),
  wikidataId: text('wikidata_id'),
  discogsMasterId: text('discogs_master_id'),
  discogsReleaseId: text('discogs_release_id'),
  spotifyAlbumId: text('spotify_album_id'),
  barcode: text('barcode'),
  catalogNumber: text('catalog_number'),
  externalIds: text('external_ids'), // JSON object
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Songs with proper FKs
export const songs = sqliteTable('songs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  duration: integer('duration'), // seconds
  artistId: integer('artist_id').notNull().references(() => artists.id),
  albumId: integer('album_id').references(() => albums.id),
  releaseDate: integer('release_date', { mode: 'timestamp' }),
  lyrics: text('lyrics'),
  annotations: text('annotations'), // JSON
  credits: text('credits'), // JSON object
  
  // Entity resolution IDs
  musicbrainzRecordingId: text('musicbrainz_recording_id').unique(),
  wikidataId: text('wikidata_id'),
  isrc: text('isrc'),
  spotifyTrackId: text('spotify_track_id'),
  geniusSongId: text('genius_song_id'),
  acoustid: text('acoustid'),
  externalIds: text('external_ids'), // JSON object
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Artist members as separate table
export const artistMembers = sqliteTable('artist_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  artistId: integer('artist_id').notNull().references(() => artists.id),
  memberName: text('member_name').notNull(),
  memberMbid: text('member_mbid'),
  instruments: text('instruments'),
  beginDate: text('begin_date'),
  endDate: text('end_date'),
  isOriginalMember: integer('is_original_member', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});