// GET /api/songs/by-slug/[slug] - Get a song by full compound slug

import { createDb } from '../../../db'
import { songs, artists, albums } from '../../../db/schema'
import { eq, and, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  
  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Slug is required'
    })
  }

  // Get D1 database instance from Cloudflare binding
  const d1 = event.context.cloudflare?.env?.DB
  if (!d1) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Database not available'
    })
  }

  const db = createDb(d1)

  try {
    // Try to find the song by trying different split points
    const parts = slug.split('-')
    
    // Try each possible split point
    for (let i = 1; i < parts.length; i++) {
      const artistSlug = parts.slice(0, i).join('-')
      const songSlug = parts.slice(i).join('-')
      
      // Check if this combination exists
      const result = await db
        .select({
          song: songs,
          artist: artists,
          album: albums
        })
        .from(songs)
        .innerJoin(artists, eq(songs.artistId, artists.id))
        .leftJoin(albums, eq(songs.albumId, albums.id))
        .where(and(
          eq(artists.slug, artistSlug),
          eq(songs.slug, songSlug)
        ))
        .limit(1)
      
      if (result.length > 0) {
        return {
          success: true,
          data: result[0]
        }
      }
    }
    
    // If no combination worked, return 404
    throw createError({
      statusCode: 404,
      statusMessage: 'Song not found'
    })
    
  } catch (error) {
    console.error('Error fetching song:', error)
    
    // If it's already an error with a status code, re-throw it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch song'
    })
  }
})