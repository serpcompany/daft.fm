// GET /api/artists/[slug] - Get artist details with albums and songs

import { getArtistBySlug, getArtistAlbums, getArtistSongs } from '../../lib/queries'
import { createDb } from '../../db/db'
import { eq } from 'drizzle-orm'
import { albums } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  
  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Artist slug is required'
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
    // For now, fetch by slug. In production, we'd use urlSlug
    const artist = await getArtistBySlug(db, slug)
    
    if (!artist) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Artist not found'
      })
    }

    // Fetch artist's albums and songs
    const [artistAlbums, artistSongs] = await Promise.all([
      getArtistAlbums(db, artist.id),
      getArtistSongs(db, artist.id)
    ])

    // Create a map of album IDs to titles for songs
    const albumMap = new Map(artistAlbums.map(album => [album.id, album.title]))

    // Add album titles to songs
    const songsWithAlbums = artistSongs.map(song => ({
      ...song,
      albumTitle: song.albumId ? albumMap.get(song.albumId) : undefined
    }))

    return {
      success: true,
      data: {
        artist,
        albums: artistAlbums,
        songs: songsWithAlbums
      }
    }
  } catch (error) {
    console.error('Error fetching artist:', error)
    
    // If it's already an error with a status code, re-throw it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch artist details'
    })
  }
})