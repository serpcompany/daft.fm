# Canonical Album Strategy

## The Problem

For The Beatles (who have ~13 actual studio albums):
- **MusicBrainz**: 639 "albums" (includes every compilation ever made)
- **Discogs**: 9,118 releases (every pressing of every format)
- **Spotify**: 27 albums (includes remasters, deluxe editions)

None give us clean canonical albums by default!

## What We Actually Want

The Beatles' canonical discography:
1. Please Please Me (1963)
2. With The Beatles (1963)
3. A Hard Day's Night (1964)
4. Beatles For Sale (1964)
5. Help! (1965)
6. Rubber Soul (1965)
7. Revolver (1966)
8. Sgt. Pepper's (1967)
9. Magical Mystery Tour (1967)
10. The White Album (1968)
11. Yellow Submarine (1969)
12. Abbey Road (1969)
13. Let It Be (1970)

## Best Strategy: Spotify as Primary Source

After testing all options, **Spotify** emerges as the best primary source because:

1. **Cleanest data** - Their catalog is already curated
2. **Canonical versions** - They typically have the "main" version of each album
3. **Always has cover art** - High quality, consistent
4. **Simple de-duplication** - Can filter by name + year

### Implementation Plan

```typescript
// 1. Get albums from Spotify (already filtered)
const albums = await getSpotifyAlbums(artistId, {
  include_groups: 'album', // Excludes singles, compilations
  limit: 50
});

// 2. De-duplicate (remove remasters, deluxe, etc)
const canonical = deduplicateAlbums(albums, {
  // Keep the oldest release date for each unique album name
  preferOriginal: true,
  // Ignore parenthetical additions like "(Remastered)"
  normalizeNames: true
});

// 3. Enrich with MusicBrainz data
for (const album of canonical) {
  const mbData = await matchToMusicBrainz(album.name, artist.name, album.release_date);
  // Get barcode, catalog number, label info
}
```

## De-duplication Rules

1. **Remove duplicates by normalized name**
   - "Abbey Road" = "Abbey Road (Remastered)" = "Abbey Road (Super Deluxe)"
   
2. **Keep the earliest release date**
   - Prefer 1969 version over 2019 remaster
   
3. **Filter obvious non-canonical**
   - Skip if title contains: "Deluxe", "Remastered", "Anniversary", "Edition"
   - Unless it's the only version available

## Fallback for Artists Not on Spotify

For artists not on Spotify, use MusicBrainz with strict filtering:
- Type = "album" 
- No secondary types (no compilation, live, etc)
- Group by normalized name
- Take earliest release

## Benefits of This Approach

1. **Clean canonical list** - What fans expect to see
2. **Avoid duplicates** - One page per album
3. **Rich data** - Can still enrich from other sources
4. **Simpler implementation** - Less filtering needed

## Entity Resolution

- **Primary key**: Our internal album ID
- **Spotify ID**: For streaming and cover art
- **MusicBrainz Release Group ID**: For metadata enrichment
- **Discogs Master ID**: Optional, for future credit enrichment