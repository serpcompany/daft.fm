# Scripts Directory Overview

## Directory Structure
```
scripts/
├── album-enrichment/   # Album data fetching and processing
├── enrichment/         # Artist data enrichment from various APIs
├── utils/              # Shared utilities and database connections
├── views/              # Scripts for viewing/debugging data
├── fetch-artists-by-popularity.ts
└── save-artists-to-staging.ts
```

## Album Management
- `album-enrichment/fetch-spotify-studio-albums.ts` - Fetches canonical studio albums from Spotify and populates staging DB

## Artist Enrichment
- `enrichment/enrich-artists.ts` - Main artist enrichment orchestrator
- `enrichment/enrich-spotify.ts` - Fetches artist data from Spotify API
- `enrichment/enrich-discogs.ts` - Fetches artist data from Discogs API
- `enrichment/enrich-lastfm.ts` - Fetches artist data from Last.fm API
- `enrichment/enrich-orchestrator.ts` - Coordinates all enrichment scripts

## Data Import
- `fetch-artists-by-popularity.ts` - Fetches artists from MusicBrainz ordered by popularity
- `save-artists-to-staging.ts` - Saves fetched artists to staging database

## Viewing/Debugging
- `views/view-staging.ts` - Shows all staging database contents (artists, albums, songs)
- `views/view-staging-data.ts` - Shows staging database overview with counts
- `views/view-albums-detail.ts` - Shows detailed album information by artist
- `views/view-enriched.ts` - Shows enriched artist data with all API fields
- `views/view-popularity-stats.ts` - Shows artist popularity statistics
- `views/check-missing-streaming-ids.ts` - Checks for artists missing Spotify/Apple Music IDs

## Utilities
- `utils/staging-db.ts` - Database connection utility (exports db instance)