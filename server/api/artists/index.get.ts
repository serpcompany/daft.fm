// GET /api/artists - List all artists with pagination and search

import { getArtists, searchArtists } from '../../lib/queries'
import { createDb } from '../../db'
import { artistListResponseSchema } from '../../types/schemas'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Math.max(1, parseInt((query.page as string) || '1'))
  const limit = Math.min(100, Math.max(1, parseInt((query.limit as string) || '20')))
  const search = query.search as string

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
    let artists
    let hasMore = false

    if (search && search.trim()) {
      // Search for artists
      const results = await searchArtists(db, search.trim(), limit, (page - 1) * limit)
      artists = results
      hasMore = results.length === limit
    } else {
      // Get paginated list of all artists
      const results = await getArtists(db, limit, (page - 1) * limit)
      artists = results
      hasMore = results.length === limit
    }

    const response = {
      success: true,
      data: artists,
      pagination: {
        page,
        limit,
        hasMore,
        total: artists.length === limit ? 'unknown' : artists.length
      },
      filters: {
        search: search || null
      }
    }

    // Validate response schema
    return artistListResponseSchema.parse(response)
  } catch (error) {
    console.error('Error fetching artists:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch artists'
    })
  }
})