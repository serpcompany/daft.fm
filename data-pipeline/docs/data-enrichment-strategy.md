# Data Enrichment Strategy

## Overview

After collecting base data from MusicBrainz, we need to enrich it with additional information from other APIs.

## Missing Data & Sources

### 1. Artist Biography
**Sources:**
- **Wikipedia** - Good content but not for smaller artists
  - MusicBrainz displays part of Wikipedia on their UI
  - Via Wikidata ID we already have
- **Last.fm** - Has a lot of content
  - Example: https://www.last.fm/music/Daft+Punk/+wiki
  - Endpoint: `artist.getInfo`
  - Returns: Biography content, summary

### 2. Artist Images
**Sources:**
- **MusicBrainz** - Has cover art for releases (via https://coverartarchive.org/) but no real artist images
- **Discogs** - Lots of great artist images
  - Example: https://www.discogs.com/artist/1289-Daft-Punk/images
  - Requires: Discogs artist ID (we have this!)
- **Last.fm** - Lots of great images
  - Example: https://www.last.fm/music/Daft+Punk/+images
  - Returns: Various image sizes
- **Wikimedia Commons** - Lots of images with search filters (like image size)
  - Example: https://commons.wikimedia.org/w/index.php?search=daft+punk
  - Can search using artist name

### 3. Additional Unique Identifiers
**Sources:**
- **Wikidata** - We have the Wikidata ID from MusicBrainz
  - Contains HUNDREDS of other unique identifiers
  - Example: https://www.wikidata.org/wiki/Q185828 (Daft Punk)
  - Can get: Apple Music ID, Deezer ID, Tidal ID, VIAF ID, AllMusic ID, and many more
  - Query Wikidata using our existing Wikidata ID or MusicBrainz ID

## Implementation Plan

### Phase 1: Last.fm Enrichment
```typescript
async function enrichWithLastfm(artist: ArtistData) {
  // Use Last.fm API to get:
  // - Biography
  // - Additional images
  // - Play count / listeners (popularity metrics)
}
```

### Phase 2: Spotify Enrichment
```typescript
async function enrichWithSpotify(artist: ArtistData) {
  // Use Spotify Web API to get:
  // - High-res artist images
  // - Popularity score (0-100)
  // - Genres (additional to MusicBrainz tags)
}
```

### Phase 3: Discogs Enrichment
```typescript
async function enrichWithDiscogs(artist: ArtistData) {
  // Use Discogs API to get:
  // - Artist images
  // - Profile/biography
  // - Real name (for stage names)
}
```

## API Keys Required

From `.env`:
- ✅ Last.fm API key (if available)
- ✅ Spotify client ID/secret (if available)
- ✅ Discogs token (if available)
- ❓ Genius API (for lyrics later)

## Rate Limiting Considerations

- Last.fm: 5 requests per second
- Spotify: 180 requests per minute
- Discogs: 60 requests per minute
- MusicBrainz: 1 request per second (already implemented)

## Data Priority

1. **Essential**: Bio, Images (at least one source)
2. **Nice to have**: Additional streaming IDs, play counts
3. **Future**: Music videos, concert data, social media stats