# Final Album Strategy: Hybrid Approach

After extensive testing, here's the optimal strategy for getting canonical albums:

## The Challenge

- **Discogs** has the best concept (master releases) but their API doesn't expose format/type in list endpoints
- **MusicBrainz** returns too many variations (639 for The Beatles)
- **Spotify** has the cleanest data but limited to their catalog

## Recommended Approach: Spotify Primary + Discogs Enrichment

### Phase 1: Get Canonical Albums from Spotify

```typescript
// 1. Fetch albums from Spotify (already filtered)
const spotifyAlbums = await getSpotifyAlbums(artistSpotifyId, {
  include_groups: 'album',
  limit: 50
});

// 2. De-duplicate to get canonical versions
const canonical = spotifyAlbums.items
  .filter(album => {
    // Skip obvious non-canonical
    const name = album.name.toLowerCase();
    return !name.includes('(remastered)') &&
           !name.includes('(deluxe') &&
           !name.includes('(super deluxe') &&
           !name.includes('anniversary');
  })
  .reduce((acc, album) => {
    // Keep earliest release of each album name
    const baseName = album.name.replace(/\s*\([^)]*\)/g, '').trim();
    if (!acc[baseName] || album.release_date < acc[baseName].release_date) {
      acc[baseName] = album;
    }
    return acc;
  }, {});
```

### Phase 2: Match to Discogs Masters

```typescript
// For each canonical album, find Discogs master
for (const album of Object.values(canonical)) {
  const discogsMatches = await searchDiscogsMasters(
    artistDiscogsId,
    album.name,
    album.release_date.substring(0, 4) // year
  );
  
  if (discogsMatches.length > 0) {
    album.discogsMasterId = discogsMatches[0].id;
  }
}
```

### Phase 3: Enrich with Additional Data

- **From Spotify**: Cover art, track count, Spotify ID
- **From Discogs Master** (if matched): Credits, genres, styles, additional images
- **From MusicBrainz** (optional): Barcode, catalog number, label info

## Benefits

1. **Clean canonical list** - Spotify's curation gives us ~13 albums for The Beatles, not 600+
2. **Rich metadata** - Can still get Discogs master details
3. **Reliable cover art** - Always available from Spotify
4. **Simpler implementation** - Less filtering logic needed

## Entity Resolution

```typescript
{
  id: 1, // Our internal ID
  title: "Abbey Road",
  slug: "abbey-road",
  artistId: 1,
  releaseDate: "1969-09-26",
  
  // External IDs
  spotifyAlbumId: "0ETFjACtuP2ADo6LFhL6HN",
  discogsMasterId: 23481,
  musicbrainzReleaseGroupId: "82ccd7db-..."
}
```

## Implementation Priority

1. **Required**: Spotify for canonical list and cover art
2. **Recommended**: Discogs masters for genre/style metadata
3. **Optional**: MusicBrainz for physical release details