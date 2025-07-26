# Data Enrichment Strategy

## Overview

After collecting base data from MusicBrainz, we need to enrich it with additional information from other APIs.

## Missing Data & Sources

### 1. Artist Biography
**Sources:**
- **Last.fm API** - Best option, has rich bios
  - Endpoint: `artist.getInfo`
  - Requires: Artist name or MusicBrainz ID
  - Returns: Biography content, summary
- **Wikipedia API** - Via Wikidata ID
  - Can fetch full article extract
  - More detailed but requires parsing

### 2. Artist Images
**Sources:**
- **Spotify Web API** - High quality artist photos
  - Endpoint: `/artists/{id}`
  - Requires: Spotify artist ID (we have this!)
  - Returns: Multiple image sizes
- **Last.fm API** - Album artwork and artist images
  - Returns: Various image sizes
- **Discogs API** - Artist photos
  - Requires: Discogs artist ID (we have this!)

### 3. Additional Streaming IDs
**Sources:**
- **Spotify Web API** 
  - Can search by artist name to get Apple Music, Tidal links
- **MusicBrainz** 
  - These are sometimes in relationships but not always
  - AllMusic, VIAF, Deezer occasionally appear

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