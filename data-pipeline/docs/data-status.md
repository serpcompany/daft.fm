# Data Collection Status

## Artists Table

### ✅ Fields We Have (from MusicBrainz)
- **name** - Artist name
- **country** - Country code (ISO)
- **formedYear** - Year formed
- **genres** - Genre tags
- **members** - Band members (in separate table)
- **musicbrainzArtistId** - MusicBrainz ID
- **wikidataEntityId** - Wikidata ID
- **discogsArtistId** - Discogs ID (format: [a12345])
- **spotifyArtistId** - Spotify ID
- **lastfmUrl** - Last.fm URL
- **isni** - International Standard Name Identifier
- **twitter** - Twitter handle
- **instagram** - Instagram handle
- **facebook** - Facebook page
- **youtubeChannelId** - YouTube channel
- **geniusArtistId** - Genius.com ID

### ❌ Fields We Still Need
- **bio** - Artist biography (need Last.fm or Wikipedia)
- **images** - Artist photos (need Spotify or Last.fm)
- **slug** - URL-friendly identifier (we can generate)
- **urlSlug** - Alternative URL slug (we can generate)

### 🔄 Partial/Sometimes Available
- **allMusicId** - Sometimes in MusicBrainz
- **viafId** - Sometimes in MusicBrainz
- **appleMusicId** - Rarely in MusicBrainz
- **tidalArtistId** - Rarely in MusicBrainz
- **deezerArtistId** - Sometimes in MusicBrainz

## Albums Table - All Fields Need to be Fetched
- title
- slug
- artistId
- releaseDate
- trackCount
- genres
- coverArt
- credits
- musicbrainzReleaseId
- wikidataEntityId
- discogsMasterId
- discogsReleaseId
- spotifyAlbumId
- barcode
- catalogNumber

## Songs Table - All Fields Need to be Fetched
- title
- slug
- duration
- artistId
- albumId
- releaseDate
- lyrics
- annotations
- credits
- musicbrainzRecordingId
- wikidataEntityId
- isrc
- spotifyTrackId
- geniusSongId
- acoustid

## Priority for Artist Enrichment

### High Priority (Core Missing Data)
1. **bio** - Essential for artist pages
2. **images** - Essential for UI

### Medium Priority (Nice to Have)
3. **appleMusicId** - For Apple Music links
4. **deezerArtistId** - For Deezer links
5. **tidalArtistId** - For Tidal links

### Low Priority (Can Generate)
6. **slug/urlSlug** - Can generate from name