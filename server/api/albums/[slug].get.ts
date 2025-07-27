// GET /api/albums/[slug] - Get album by compound slug
// URL format: /api/albums/artist-slug-album-slug

import { createDb } from '../../db/db'
import { and, eq } from 'drizzle-orm'
import { albums, artists, songs } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  
  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Album slug is required'
    })
  }

  // Parse compound slug - find the last hyphen to split artist and album
  // This handles cases where artist or album names contain hyphens
  const parts = slug.split('-')
  
  // Try different split points to find the correct artist/album combination
  let artist = null
  let album = null
  
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
    // Try each possible split point
    for (let i = 1; i < parts.length; i++) {
      const artistSlug = parts.slice(0, i).join('-')
      const albumSlug = parts.slice(i).join('-')
      
      // First find the artist
      const artistResults = await db.select().from(artists).where(eq(artists.slug, artistSlug)).limit(1)
      
      if (artistResults.length > 0) {
        const foundArtist = artistResults[0]
        
        // Then find the album
        const albumResults = await db.select().from(albums)
          .where(and(
            eq(albums.artistId, foundArtist.id),
            eq(albums.slug, albumSlug)
          ))
          .limit(1)
        
        if (albumResults.length > 0) {
          artist = foundArtist
          album = albumResults[0]
          break
        }
      }
    }
    
    if (!artist || !album) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Album not found'
      })
    }
    
    // Fetch all songs in the album
    const albumSongs = await db.select().from(songs)
      .where(eq(songs.albumId, album.id))
      .orderBy(songs.title) // Should order by track number when available
    
    return {
      success: true,
      data: {
        album,
        artist,
        songs: albumSongs
      }
    }
  } catch (error) {
    console.error('Error fetching album:', error)
    
    // If it's already an error with a status code, re-throw it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch album'
    })
  }
})