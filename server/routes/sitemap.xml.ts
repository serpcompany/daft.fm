import { createDb } from '../db/'
import { artists, albums, songs } from '../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // Get D1 database instance
  const d1 = event.context.cloudflare?.env?.DB
  if (!d1) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Database not available'
    })
  }
  
  const db = createDb(d1)
  const baseUrl = process.env.NUXT_PUBLIC_URL || 'https://daft.fm'
  
  // Start building the sitemap
  let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
  sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

  // Add homepage
  sitemap += `  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>\n`

  // Add listing pages
  const listingPages = ['/artists', '/albums', '/songs']
  for (const page of listingPages) {
    sitemap += `  <url>
    <loc>${baseUrl}${page}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>\n`
  }

  // Add all artists
  const allArtists = await db.select({
    slug: artists.slug,
    updatedAt: artists.updatedAt
  }).from(artists)

  for (const artist of allArtists) {
    sitemap += `  <url>
    <loc>${baseUrl}/artists/${artist.slug}</loc>
    <lastmod>${new Date(artist.updatedAt).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>\n`
  }

  // Add all albums
  const allAlbums = await db.select({
    slug: albums.slug,
    artistSlug: artists.slug,
    updatedAt: albums.updatedAt
  }).from(albums)
    .innerJoin(artists, eq(albums.artistId, artists.id))

  for (const album of allAlbums) {
    sitemap += `  <url>
    <loc>${baseUrl}/albums/${album.artistSlug}-${album.slug}</loc>
    <lastmod>${new Date(album.updatedAt).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>\n`
  }

  // Add all songs
  const allSongs = await db.select({
    slug: songs.slug,
    artistSlug: artists.slug,
    updatedAt: songs.updatedAt
  }).from(songs)
    .innerJoin(artists, eq(songs.artistId, artists.id))

  for (const song of allSongs) {
    sitemap += `  <url>
    <loc>${baseUrl}/songs/${song.artistSlug}-${song.slug}</loc>
    <lastmod>${new Date(song.updatedAt).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>\n`
  }

  // Close the sitemap
  sitemap += '</urlset>'

  // Set content type
  setHeader(event, 'content-type', 'text/xml; charset=utf-8')
  
  return sitemap
})