// GET /api/songs/[slug] - Get song by compound slug
// URL format: /api/songs/artist-slug-song-slug

import { createDb } from '../../db'
import { and, eq } from 'drizzle-orm'
import { songs, artists, albums } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  
  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Song slug is required'
    })
  }

  // Parse compound slug - find the last hyphen to split artist and song
  // This handles cases where artist or song names contain hyphens
  const parts = slug.split('-')
  
  // Try different split points to find the correct artist/song combination
  let artist = null
  let song = null
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
      const songSlug = parts.slice(i).join('-')
      
      // First find the artist
      const artistResults = await db.select().from(artists).where(eq(artists.slug, artistSlug)).limit(1)
      
      if (artistResults.length > 0) {
        const foundArtist = artistResults[0]
        
        // Then find the song
        const songResults = await db.select().from(songs)
          .where(and(
            eq(songs.artistId, foundArtist.id),
            eq(songs.slug, songSlug)
          ))
          .limit(1)
        
        if (songResults.length > 0) {
          artist = foundArtist
          song = songResults[0]
          break
        }
      }
    }
    
    if (!artist || !song) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Song not found'
      })
    }
    
    // Fetch the album if the song has one
    if (song.albumId) {
      const albumResults = await db.select().from(albums)
        .where(eq(albums.id, song.albumId))
        .limit(1)
      
      if (albumResults.length > 0) {
        album = albumResults[0]
      }
    }
    
    return {
      success: true,
      data: {
        song,
        artist,
        album
      }
    }
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