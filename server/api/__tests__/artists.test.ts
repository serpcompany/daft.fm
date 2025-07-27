import { describe, it, expect, vi, beforeAll } from 'vitest'
import { getArtists, searchArtists } from '../../lib/queries'

// Mock Nitro/H3 utilities before importing handler
global.defineEventHandler = vi.fn((handler) => handler)
global.getQuery = vi.fn()
global.createError = vi.fn((options) => new Error(options.statusMessage))

// Import handler after mocks are set up
const handler = await import('../artists/index.get').then(m => m.default)

// Mock the queries module
vi.mock('../../lib/queries', () => ({
  getArtists: vi.fn(),
  searchArtists: vi.fn()
}))

// Mock createDb
vi.mock('../../db', () => ({
  createDb: vi.fn(() => ({}))
}))

describe('Artists API', () => {
  const mockEvent = {
    context: {
      cloudflare: {
        env: {
          DB: {} // Mock D1 database
        }
      }
    }
  }

  it('should return paginated artists list', async () => {
    const mockArtists = [
      {
        id: '1',
        name: 'Test Artist',
        slug: 'test-artist',
        urlSlug: 'test-artist',
        country: 'US',
        formedYear: 2020,
        genres: '["rock"]',
        bio: null,
        images: null,
        wikidataId: null,
        externalIds: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    // @ts-ignore
    getArtists.mockResolvedValue(mockArtists)

    // @ts-ignore
    const result = await handler({
      ...mockEvent,
      // @ts-ignore
      getQuery: () => ({ page: '1', limit: '20' })
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockArtists)
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      hasMore: false,
      total: 1
    })
  })

  it('should search artists when search query is provided', async () => {
    const mockSearchResults = [
      {
        id: '2',
        name: 'Search Result',
        slug: 'search-result',
        urlSlug: 'search-result',
        country: 'UK',
        formedYear: 2021,
        genres: '["pop"]',
        bio: null,
        images: null,
        wikidataId: null,
        externalIds: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    // @ts-ignore
    searchArtists.mockResolvedValue(mockSearchResults)

    // @ts-ignore
    const result = await handler({
      ...mockEvent,
      // @ts-ignore
      getQuery: () => ({ page: '1', limit: '20', search: 'search' })
    })

    expect(searchArtists).toHaveBeenCalledWith(expect.any(Object), 'search', 20, 0)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockSearchResults)
  })

  it('should handle pagination correctly', async () => {
    const mockArtists = Array(20).fill(null).map((_, i) => ({
      id: `${i}`,
      name: `Artist ${i}`,
      slug: `artist-${i}`,
      urlSlug: `artist-${i}`,
      country: 'US',
      formedYear: 2020,
      genres: '["rock"]',
      bio: null,
      images: null,
      wikidataId: null,
      externalIds: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }))

    // @ts-ignore
    getArtists.mockResolvedValue(mockArtists)

    // @ts-ignore
    const result = await handler({
      ...mockEvent,
      // @ts-ignore
      getQuery: () => ({ page: '2', limit: '20' })
    })

    expect(getArtists).toHaveBeenCalledWith(expect.any(Object), 20, 20)
    expect(result.pagination.hasMore).toBe(true)
  })
})