# README

These scripts are for the data pipeline.

We want to build a safe way to collect, validate, and deploy music data into a staging db totally separate from the nuxt project (and will probably move it out to a new repo later).

The goal is to setup a data pipeline that will help us get the data we need to populate our database with music related data.

## Data Needed (v1)

We need to populate data for artists, songs, and albums. 

No one API has all the info we need so we have to start somewhere (musicbrainz), grab the info that we can + as many unique identifiers that can be used later to help use with entity resolution and matching as we collect different data points from various places.

Below is a checklist of the data we will attempt to build a pipeline to get.

This is not to be taken as official schema, nor is it all of the fields. 

For example, you can see that there are no primary keys listed here, nor are there "slug" values (for the URLs) ... those type of auto incrementing fields and default populating fields like created time will be defined officially in this schema. This is more just a checklist of things we can try and build for.

## Data Sources & Tracking

We get our data from APIs.

See the `.env` file for the API keys we have. There are other APIs that we can add as we need them.


## Artists Table

| Field | Description | Source API | Endpoint/Method | Notes | Retrieved |
|-------|-------------|------------|-----------------|-------|-----------|
| **Core Fields** |
| name | Artist or band name | MusicBrainz | /artist/{mbid} | | ✓ |
| slug | URL-friendly identifier | | | | ☐ |
| urlSlug | Alternative URL slug | | | | ☐ |
| country | Country of origin | MusicBrainz | /artist/{mbid} | ISO code | ✓ |
| formedYear | Year formed | MusicBrainz | /artist/{mbid} | From life-span.begin | ✓ |
| genres | JSON array of genres | MusicBrainz | /artist/{mbid}?inc=tags | | ✓ |
| members | JSON array of member names | MusicBrainz | /artist/{mbid}?inc=artist-rels | See artist_members table | ✓ |
| bio | Artist biography | Last.fm / Wikipedia | | Need separate API call | ☐ |
| images | JSON array of image URLs | Spotify / Last.fm | | Need separate API call | ☐ |
| **Entity Resolution** |
| musicbrainzArtistId | MusicBrainz artist MBID | MusicBrainz | /artist/{mbid} | | ✓ |
| wikidataEntityId | Wikidata Q-identifier | MusicBrainz | /artist/{mbid}?inc=url-rels | From relationships | ✓ |
| discogsArtistId | Discogs artist ID | MusicBrainz | /artist/{mbid}?inc=url-rels | Format: [a12345] | ✓ |
| spotifyArtistId | Spotify artist ID | MusicBrainz | /artist/{mbid}?inc=url-rels | From relationships | ✓ |
| lastfmUrl | Last.fm profile URL | MusicBrainz | /artist/{mbid}?inc=url-rels | Full URL | ✓ |
| isni | International Standard Name Identifier | MusicBrainz | /artist/{mbid} | | ✓ |
| externalIds | JSON object for additional IDs | MusicBrainz | /artist/{mbid}?inc=url-rels | Multiple sources | ✓ |
| **Social Media** |
| twitter | Twitter handle | MusicBrainz | /artist/{mbid}?inc=url-rels | From relationships | ✓ |
| instagram | Instagram handle | MusicBrainz | /artist/{mbid}?inc=url-rels | From relationships | ✓ |
| facebook | Facebook page | MusicBrainz | /artist/{mbid}?inc=url-rels | From relationships | ✓ |
| youtubeChannelId | YouTube channel ID | MusicBrainz | /artist/{mbid}?inc=url-rels | From relationships | ✓ |
| **Additional IDs** |
| geniusArtistId | Genius.com artist ID | MusicBrainz | /artist/{mbid}?inc=url-rels | From relationships | ✓ |
| allMusicId | AllMusic artist ID | MusicBrainz | /artist/{mbid}?inc=url-rels | Sometimes available | ☐ |
| viafId | VIAF ID | MusicBrainz | /artist/{mbid}?inc=url-rels | Sometimes available | ☐ |
| appleMusicId | Apple Music ID | MusicBrainz | /artist/{mbid}?inc=url-rels | Rarely in relationships | ☐ |
| tidalArtistId | Tidal artist ID | MusicBrainz | /artist/{mbid}?inc=url-rels | Rarely in relationships | ☐ |
| deezerArtistId | Deezer artist ID | MusicBrainz | /artist/{mbid}?inc=url-rels | Sometimes available | ☐ |

## Artist Members Table

| Field | Description | Source API | Endpoint/Method | Notes | Retrieved |
|-------|-------------|------------|-----------------|-------|-----------|
| artistId | Foreign key to artists table | | | | ✓ |
| memberName | Member's name | MusicBrainz | /artist/{mbid}?inc=artist-rels | | ✓ |
| memberMbid | Member's MusicBrainz ID | MusicBrainz | /artist/{mbid}?inc=artist-rels | | ✓ |
| instruments | Instruments played | MusicBrainz | /artist/{mbid}?inc=artist-rels | From attributes | ✓ |
| beginDate | When member joined | MusicBrainz | /artist/{mbid}?inc=artist-rels | | ✓ |
| endDate | When member left | MusicBrainz | /artist/{mbid}?inc=artist-rels | | ✓ |
| isOriginalMember | Original member flag | MusicBrainz | /artist/{mbid}?inc=artist-rels | From attributes | ✓ |

## Albums Table

| Field | Description | Source API | Endpoint/Method | Notes | Retrieved |
|-------|-------------|------------|-----------------|-------|-----------|
| **Core Fields** |
| title | Album title | | | | ☐ |
| slug | URL-friendly identifier | | | | ☐ |
| artistId | Foreign key to artists table | | | | ☐ |
| releaseDate | Album release date | | | | ☐ |
| trackCount | Number of tracks | | | | ☐ |
| genres | JSON array of genres | | | | ☐ |
| coverArt | JSON array of cover art URLs | | | | ☐ |
| credits | JSON object of album credits | | | | ☐ |
| **Entity Resolution** |
| musicbrainzReleaseId | MusicBrainz release MBID | | | | ☐ |
| wikidataEntityId | Wikidata Q-identifier | | | | ☐ |
| discogsMasterId | Discogs master release ID | | | | ☐ |
| discogsReleaseId | Discogs release ID | | | | ☐ |
| spotifyAlbumId | Spotify album ID | | | | ☐ |
| barcode | Album barcode | | | | ☐ |
| catalogNumber | Record label catalog number | | | | ☐ |
| externalIds | JSON object for additional IDs | | | | ☐ |


## Songs Table

| Field | Description | Source API | Endpoint/Method | Notes | Retrieved |
|-------|-------------|------------|-----------------|-------|-----------|
| **Core Fields** |
| title | Song title | | | | ☐ |
| slug | URL-friendly identifier | | | | ☐ |
| duration | Duration in seconds | | | | ☐ |
| artistId | Foreign key to artists table | | | | ☐ |
| albumId | Foreign key to albums table | | | | ☐ |
| releaseDate | Song release date | | | | ☐ |
| lyrics | Song lyrics text | | | | ☐ |
| annotations | Lyrics annotations | | | | ☐ |
| credits | JSON object of song credits | | | | ☐ |
| **Entity Resolution** |
| musicbrainzRecordingId | MusicBrainz recording MBID | | | | ☐ |
| wikidataEntityId | Wikidata Q-identifier | | | | ☐ |
| isrc | International Standard Recording Code | | | | ☐ |
| spotifyTrackId | Spotify track ID | | | | ☐ |
| geniusSongId | Genius.com song ID | | | | ☐ |
| acoustid | AcoustID fingerprint | | | | ☐ |
| externalIds | JSON object for additional IDs | | | | ☐ |


We should figure out how to get these 1 by 1, and as we do we should organize and document our code. Maybe like:

**Documentation (like the markdown above) for:**

Planning which APIs to use
Tracking implementation progress
Understanding data mappings
Onboarding new developers


**Code organization for:**

Actual implementation
Maintainability
Testing individual data sources
Handling API-specific logic


# Data Collection Strategy

# Data Collection Strategy

- Initial Collection: Fetch top 100 artists by popularity from MusicBrainz
- Data Enrichment: Add missing data from complementary sources

 ## STEP 1: GET DATA

1. Get Artists from Musicbrainz, prioritizing the most popular artists using by MusicBrainz "External Relationship Count"

2. For Each Artist: Get "Albums" (Get Canonical Release Pick earliest official release - avoid bootlegs/promos/dupes)
   - Skip non-album types to start
   - skip singles
   - skip compilations
   - etc.

The goal is to end up with the main "album" for the artist, where that album page would contain the tracklist of what is on that album.


3. For Each Album: Get Songs

Note: music brainz has all the releases. its messy. 

We want Get all the songs on that album but We dont want every release of the song, just the canonical/main song associated to the album.

Maybe it can be done from musicbrainz, or maybe its easier to get it from discogs - as they have much more clean data when it comes to "albums"

For example:

- the 'album' page for Daft Punk - Discovery has at least 22+ versions of it - https://musicbrainz.org/release-group/48117b90-a16e-34ca-a514-19c702df1158 
- discogs has a clean way to find it https://www.discogs.com/artist/1289-Daft-Punk?superFilter=Releases&subFilter=Albums


This is the same for really everything so we need to figure it out, then get it, then document it



4. Get as many of the entity resolution modifiers as we can find for each api call/script we do. Musicbrainz has a ton of them. 
   - Discogs IDs, Genius IDs, Spotify IDs, Wikidata Q-numbers
   - Store for future cross-platform data enrichment

## STEP 2: QC

- Does it look right?

After running on 100, we only had 77 artists with 335 albums (clearly wrong) 

...and these fields were missing:

Artists (all 75 missing):

- ❌ bio - Artist biographies
- ❌ images - Artist photos
- ❌ members - Band member names

Albums (all 355 missing):

- ❌ cover_art - Album artwork
- ❌ credits - Producer, engineer credits
- ❌ wikidata_id - Wikidata identifiers

Songs (all 4,142 missing):

- ❌ lyrics - Song lyrics
- ❌ annotations - Lyric explanations
- ❌ credits - Writer, producer credits
- ❌ isrc - International recording codes
- ❌ wikidata_id - Wikidata identifiers

## STEP 3: FINALIZE

After we manualy review the data is good, the method is good, we need to make the "function" modular and easy to find and work with. 

We should write JSDoc comment blocks for it too explaining things so we can auto generate docs later.


# Data Reference

We did a bit of a messy rough draft on this one time already and I have saved that folder for reference at this location. 

Only use it for referencing or getting ideas from, if needed. It's too messy to refactor. We want to really start from scratch, but it's good information to see.

- Location: `/Users/devin/repos/projects/daft.fm/.claude/reference/data-pipeline-old`