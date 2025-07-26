# MusicBrainz API

## Base URL
`https://musicbrainz.org/ws/2`

## Rate Limit
1 request/second

## What We Get
- Artist info (name, country, formed year)
- Genre tags
- Band members with dates/instruments
- External IDs (Spotify, Discogs, Wikidata, Last.fm, social media)
- ISNI

## What We Don't Get
- Bios
- Images
- Play counts

## Key Endpoints
- `/artist/{mbid}?inc=url-rels+artist-rels+tags`
- `/release-group?artist={mbid}&type=album`
- `/release/{mbid}?inc=recordings`