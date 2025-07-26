# Enrichment API Findings

## Overview

This document consolidates our research and testing results for enriching artist data beyond what MusicBrainz provides.

## Artist Biography

### Sources Tested

1. **Last.fm** ✅ BEST OPTION
   - Rich, detailed biographies (8,858 chars for The Beatles)
   - Available via API: `artist.getInfo`
   - Reliable for popular artists
   - Example: https://www.last.fm/music/Daft+Punk/+wiki

2. **Wikipedia** ⚠️
   - Excellent content but not for smaller artists
   - MusicBrainz displays Wikipedia excerpts on their UI
   - Can access via Wikidata ID we already have

3. **Discogs** ✅ GOOD ALTERNATIVE
   - Shorter profiles (1,136 chars for The Beatles)
   - Available via API with authentication
   - More technical/discography focused

## Artist Images

### API vs Reality

Our testing revealed a significant gap between API responses and actual available images:

| Source | API Returns | Actually Available |
|--------|-------------|-------------------|
| Last.fm | 6 images | 1,593 images (The Beatles) |
| Spotify | 3 images | 3 images |
| Discogs | 62 images | 62+ images |

### Last.fm Image Discovery

Last.fm has thousands of user-uploaded images not exposed via API. We discovered the URL pattern:

```
Page URL: https://www.last.fm/music/{Artist}/+images/{image_id}
Direct Image: https://lastfm.freetls.fastly.net/i/u/770x0/{image_id}.jpg#{image_id}
```

Examples:
- `e90c9f6219d9c83dd9ba60375ba93de0`
- `b9517267fed1c07a97f402dda0231c6a`

**Note**: We should store URLs, not download images (too much data).

### Image Source Recommendations

1. **Official/Primary Images**
   - Spotify: 3 high-quality images via API
   - Last.fm: 6 sizes via API + banner image

2. **Extended Gallery**
   - Discogs: 62 images via API
   - Last.fm: 1000+ images (need to explore scraping/discovery)
   - Wikimedia Commons: Search by artist name

## Streaming Platform IDs

### Wikidata as Central Hub

The Beatles Wikidata entry (Q1299) demonstrates the wealth of identifiers available:
- Contains HUNDREDS of external identifiers
- Includes Apple Music, Deezer, Tidal, and many more
- Can query via SPARQL API using our MusicBrainz ID

### Fixed Extraction

We discovered MusicBrainz stores Wikidata as a specific relation type, not just a URL:
```typescript
if (relation.type === 'wikidata' && relation.url?.resource) {
  externalIds.wikidataEntityId = relation.url.resource.split('wikidata.org/wiki/')[1];
}
```

## Implementation Priority

1. **Phase 1: Basic Enrichment** ← CURRENT FOCUS
   - Last.fm bio via API
   - Spotify/Last.fm official images via API
   - Store image URLs only

2. **Phase 2: Extended Data**
   - Wikidata SPARQL for streaming IDs
   - Discogs extended images
   - Last.fm image discovery

3. **Phase 3: Advanced Features**
   - Last.fm banner images
   - Image gallery URLs (not downloads)
   - Additional metadata from Wikidata

## Rate Limits to Consider

- Last.fm: 5 requests/second
- Spotify: 180 requests/minute
- Discogs: 60 requests/minute
- Wikidata: No hard limit, be reasonable
- MusicBrainz: 1 request/second (already implemented)