import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const albumComparison = sqliteTable('album_comparison', {
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