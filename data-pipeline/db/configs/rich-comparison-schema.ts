import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const albumComparisonRich = sqliteTable('album_comparison_rich', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Source info
  source: text('source').notNull(),
  sourceId: text('source_id'),
  
  // Basic album info
  artistName: text('artist_name').notNull(),
  artistId: text('artist_id'),
  albumTitle: text('album_title').notNull(),
  releaseYear: integer('release_year'),
  
  // Discogs specific
  masterId: integer('master_id'),
  mainReleaseId: integer('main_release_id'),
  resourceUrl: text('resource_url'),
  uri: text('uri'),
  
  // Format and release info
  format: text('format'),
  country: text('country'),
  label: text('label'),
  catalogNumber: text('catalog_number'),
  barcode: text('barcode'),
  
  // Content info
  trackCount: integer('track_count'),
  durationSeconds: integer('duration_seconds'),
  tracklist: text('tracklist'), // JSON
  
  // Metadata
  genres: text('genres'), // JSON array
  styles: text('styles'), // JSON array
  
  // Images
  coverImageUrl: text('cover_image_url'),
  imageCount: integer('image_count'),
  images: text('images'), // JSON array
  
  // Additional data
  videos: text('videos'), // JSON array
  artistsSort: text('artists_sort'),
  dataQuality: text('data_quality'),
  numForSale: integer('num_for_sale'),
  lowestPrice: real('lowest_price'),
  
  // Analysis fields
  notes: text('notes'),
  isCompilation: integer('is_compilation').default(0),
  isLive: integer('is_live').default(0),
  isSoundtrack: integer('is_soundtrack').default(0),
  isUnofficial: integer('is_unofficial').default(0),
  
  // Timestamps
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});