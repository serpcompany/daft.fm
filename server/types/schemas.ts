import { z } from 'zod'
import { artists, albums, songs } from '../db/schema'

// Transform date strings to Date objects or keep as strings
const dateTransform = z.union([
  z.string().datetime(),
  z.date(),
  z.null()
])

// Base schemas with proper type handling
export const artistSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  urlSlug: z.string(),
  country: z.string().nullable(),
  formedYear: z.number().nullable(),
  genres: z.string().nullable(), // JSON string
  bio: z.string().nullable(),
  images: z.string().nullable(), // JSON string
  wikidataId: z.string().nullable(),
  externalIds: z.string().nullable(), // JSON string
  createdAt: dateTransform,
  updatedAt: dateTransform
}).passthrough() // Allow extra fields

export const albumSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  artistId: z.string(),
  releaseDate: dateTransform,
  trackCount: z.number().nullable(),
  coverArt: z.string().nullable(), // JSON string
  wikidataId: z.string().nullable(),
  externalIds: z.string().nullable(), // JSON string
  createdAt: dateTransform,
  updatedAt: dateTransform
}).passthrough()

export const songSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  duration: z.number().nullable(),
  artistId: z.string(),
  albumId: z.string().nullable(),
  releaseDate: dateTransform,
  lyrics: z.string().nullable(),
  annotations: z.string().nullable(),
  isrc: z.string().nullable(),
  wikidataId: z.string().nullable(),
  externalIds: z.string().nullable(), // JSON string
  createdAt: dateTransform,
  updatedAt: dateTransform
}).passthrough()

// Extended schemas with relations
export const artistWithStatsSchema = z.object({
  artist: artistSchema,
  albumCount: z.number(),
  songCount: z.number()
})

export const albumWithArtistSchema = albumSchema.extend({
  artistName: z.string(),
  artistSlug: z.string()
})

export const songWithDetailsSchema = songSchema.extend({
  artistName: z.string(),
  artistSlug: z.string(),
  albumTitle: z.string().optional().nullable(),
  albumSlug: z.string().optional().nullable()
})

// API Response schemas
export const paginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
  total: z.union([z.number(), z.literal('unknown')])
})

export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  success: z.boolean(),
  data: dataSchema,
  pagination: paginationSchema.optional(),
  filters: z.record(z.any()).optional()
}).passthrough() // Allow extra fields in response

// List response schemas
export const artistListResponseSchema = apiResponseSchema(z.array(artistSchema))
export const albumListResponseSchema = apiResponseSchema(z.array(albumWithArtistSchema))
export const songListResponseSchema = apiResponseSchema(z.array(songWithDetailsSchema))

// Detail response schemas
export const artistDetailResponseSchema = apiResponseSchema(artistWithStatsSchema)
export const albumDetailResponseSchema = apiResponseSchema(z.object({
  album: albumSchema,
  artist: artistSchema,
  songs: z.array(songSchema)
}))
export const songDetailResponseSchema = apiResponseSchema(z.object({
  song: songSchema,
  artist: artistSchema,
  album: albumSchema.optional()
}))

// Type exports
export type Artist = z.infer<typeof artistSchema>
export type Album = z.infer<typeof albumSchema>
export type Song = z.infer<typeof songSchema>
export type ArtistWithStats = z.infer<typeof artistWithStatsSchema>
export type AlbumWithArtist = z.infer<typeof albumWithArtistSchema>
export type SongWithDetails = z.infer<typeof songWithDetailsSchema>