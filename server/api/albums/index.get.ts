// GET /api/albums - List albums with pagination, search, and filtering

import { getAlbums, getAlbumsWithArtists, searchAlbums, getAlbumsByArtist } from '../../lib/queries'
import { createDb } from '../../db'
import { albumListResponseSchema } from '../../types/schemas'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Math.max(1, parseInt((query.page as string) || '1'))
  const limit = Math.min(100, Math.max(1, parseInt((query.limit as string) || '20')))
  const search = query.search as string
  const artistId = query.artistId as string

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
    let albums
    let hasMore = false

    if (search && search.trim()) {
      // Search for albums
      const results = await searchAlbums(db, search.trim(), limit, (page - 1) * limit)
      albums = results
      hasMore = results.length === limit
    } else if (artistId) {
      // Get albums by specific artist
      const results = await getAlbumsByArtist(db, artistId, limit, (page - 1) * limit)
      albums = results
      hasMore = results.length === limit
    } else {
      // Get paginated list of all albums with artist names
      const results = await getAlbumsWithArtists(db, limit, (page - 1) * limit)
      albums = results
      hasMore = results.length === limit
    }

    // The data from getAlbumsWithArtists already includes the joined fields
    const mappedAlbums = albums

    const response = {
      success: true,
      data: mappedAlbums,
      pagination: {
        page,
        limit,
        hasMore,
        total: mappedAlbums.length === limit ? 'unknown' : mappedAlbums.length
      },
      filters: {
        search: search || null,
        artistId: artistId || null
      }
    }

    // Validate response schema
    return albumListResponseSchema.parse(response)
  } catch (error) {
    console.error('Error fetching albums:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch albums'
    })
  }
})