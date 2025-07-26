# Entity Resolution Strategy

This document defines how we match artists across different platforms to ensure data accuracy.

## Overview

Entity resolution (or entity matching) is the process of determining whether records from different sources refer to the same real-world entity. For artists, this is critical because:
- Artist names can vary (The Beatles vs Beatles vs "Beatles, The")
- Multiple artists may share the same name
- Artists may use different names on different platforms

## Our Resolution Strategy by Source

### 1. Last.fm
**Primary Match**: MusicBrainz ID (mbid)
**Fallback**: Artist name

```typescript
enrichArtistBioFromLastFm(artistName: string, mbid?: string)
```

- **Why it works**: Last.fm directly supports MusicBrainz IDs in their API
- **Confidence**: HIGH when using mbid, MEDIUM with name only
- **Example**: `mbid=b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d` uniquely identifies The Beatles

### 2. Spotify
**Primary Match**: Spotify Artist ID (from MusicBrainz)
**No Fallback**: We require the exact Spotify ID

```typescript
enrichArtistImagesFromSpotify(spotifyId: string)
enrichArtistGenresFromSpotify(spotifyId: string)
```

- **Why it works**: We already have Spotify IDs from MusicBrainz relationships
- **Confidence**: VERY HIGH - using exact platform ID
- **Example**: `3WrFJ7ztbogyGnTHbHJFl2` is The Beatles on Spotify

### 3. Discogs
**Primary Match**: Discogs Artist ID (from MusicBrainz)
**No Fallback**: We require the exact Discogs ID

```typescript
enrichArtistImageFromDiscogs(discogsId: string)
```

- **Why it works**: We already have Discogs IDs from MusicBrainz relationships
- **Confidence**: VERY HIGH - using exact platform ID
- **Example**: `[a82730]` → `82730` is The Beatles on Discogs

### 4. Wikidata (Future)
**Primary Match**: Wikidata Entity ID (from MusicBrainz)
**No Fallback**: We require the exact Wikidata ID

- **Why it works**: MusicBrainz stores Wikidata IDs as specific relation types
- **Confidence**: VERY HIGH - using exact entity ID
- **Example**: `Q1299` is The Beatles on Wikidata

## Data Flow

```
MusicBrainz (Source of Truth)
    ├── mbid: b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d
    ├── name: "The Beatles"
    └── relationships:
        ├── spotify: 3WrFJ7ztbogyGnTHbHJFl2
        ├── discogs: [a82730]
        ├── wikidata: Q1299
        └── lastfm: (uses mbid or name)

Enrichment APIs
    ├── Last.fm: GET /artist.getinfo?mbid={mbid}
    ├── Spotify: GET /artists/{spotifyId}
    ├── Discogs: GET /artists/{discogsId}
    └── Wikidata: SPARQL query with {wikidataId}
```

## Validation Rules

1. **Never guess IDs**: If we don't have a platform ID from MusicBrainz, we don't fetch from that platform
2. **MusicBrainz as ground truth**: All IDs come from MusicBrainz relationships
3. **No fuzzy matching**: We don't attempt to match by similar names
4. **Log missing IDs**: Track which artists are missing which platform IDs

## Edge Cases Handled

1. **Artist name changes**: Using IDs avoids issues with name changes
2. **Multiple artists same name**: IDs ensure we get the correct artist
3. **Regional variations**: IDs work globally, names might vary by region
4. **Special characters**: IDs avoid encoding issues with names like "Björk"

## Future Improvements

1. **Name-based fallback for Spotify/Discogs**: Could implement search endpoints
2. **Confidence scoring**: Return confidence level with each enrichment
3. **Alternative ID sources**: Wikidata has many more IDs we could use
4. **Validation endpoint**: Check if our stored IDs are still valid

## Implementation Notes

- All enrichment functions return `null` if no match is found
- We track which sources provided data in `dataSourcesUsed`
- Rate limiting prevents hitting APIs too frequently
- Each function is independent and can fail gracefully