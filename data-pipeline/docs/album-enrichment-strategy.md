# Album Enrichment Strategy

## Overview

After extensive testing of multiple music APIs (MusicBrainz, Discogs, Spotify), we've determined that **Spotify's API with proper filtering** provides the cleanest canonical album data.

## Final Approach

We use the Spotify Web API with the following strategy:

1. **Filter by album type**: Use `include_groups=album` parameter to get only studio albums
2. **Remove live albums and compilations**: Filter out albums with keywords like "live", "tour", "greatest hits", etc.
3. **Deduplicate**: Remove suffixes like "(Remastered)", "(Deluxe Edition)" and keep earliest release
4. **Create unique slugs**: Generate URL-friendly slugs using artist-album combination

## Implementation

The main script is located at: `scripts/album-enrichment/fetch-spotify-studio-albums.ts`

### What it does:
- Fetches albums for specified artists from Spotify
- Filters to only studio albums
- Deduplicates multiple versions
- Populates the staging database with clean data

### Database fields populated:
- `title`: Album name (cleaned)
- `slug`: URL-friendly identifier
- `artist_id`: Foreign key to artists table
- `release_date`: Year of release
- `track_count`: Number of tracks
- `spotify_album_id`: Spotify's unique identifier
- `cover_art`: Album artwork URL

## Results

For our test artists:
- **The Beatles**: 14 studio albums (missing only "Magical Mystery Tour")
- **Pink Floyd**: 17 studio albums
- **David Bowie**: 27 studio albums
- **Led Zeppelin**: 12 albums
- **The Rolling Stones**: 23 albums

Total: 93 canonical studio albums successfully imported.

## Next Steps

With clean canonical album data in place, we can:
1. Match albums to MusicBrainz Release Groups for additional metadata
2. Match albums to Discogs Master IDs for collectibility data
3. Fetch track listings from Spotify
4. Enrich with additional metadata (genres, credits, etc.)