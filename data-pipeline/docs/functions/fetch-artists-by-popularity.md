# fetch-artists-by-popularity.ts

## Purpose
Get top artists from MusicBrainz ranked by relationship count

## Usage
```typescript
const artists = await fetchArtistsByPopularity(10);
```

## Returns
```typescript
{
  name: string,
  country: string,
  formedYear: number,
  genres: string[],
  members: Array<{
    name: string,
    mbid: string,
    instruments: string,
    beginDate: string,
    endDate: string
  }>,
  musicbrainzArtistId: string,
  spotifyArtistId: string,
  discogsArtistId: string,  // Format: [a12345]
  // ... other external IDs
}
```

## Notes
- Uses relationship count + (tags × 2) for popularity
- Fetches 5× candidates, returns top N
- Excludes "Various Artists" and "[unknown]"