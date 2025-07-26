# Entity Relationship Diagram

## CORRECTED SCHEMA (with proper PKs)

```
┌─────────────────────────────────────┐
│            ARTISTS                  │
├─────────────────────────────────────┤
│ PK  id (integer) AUTOINCREMENT      │
│     name (text) NOT NULL            │
│ UK  slug (text) NOT NULL            │
│ UK  urlSlug (text) NOT NULL         │
│     country (text)                  │
│     formedYear (integer)            │
│     genres (text/JSON)              │
│     bio (text)                      │
│     images (text/JSON)              │
│ UK  musicbrainzId (text)            │◄── Should be UNIQUE
│     wikidataId (text)               │
│     externalIds (text/JSON)         │
│     createdAt (timestamp)           │
│     updatedAt (timestamp)           │
└─────────────────────────────────────┘
           │
           │ 1
           │
           │ ∞
           ▼
┌─────────────────────────────────────┐
│            ALBUMS                   │
├─────────────────────────────────────┤
│ PK  id (integer) AUTOINCREMENT      │
│     title (text) NOT NULL           │
│ UK  slug (text) NOT NULL            │
│ FK  artistId (integer) NOT NULL ───┤
│     releaseDate (timestamp)         │
│     trackCount (integer)            │
│     coverArt (text/JSON)            │
│ UK  musicbrainzId (text)            │◄── Should be UNIQUE
│     wikidataId (text)               │
│     externalIds (text/JSON)         │
│     createdAt (timestamp)           │
│     updatedAt (timestamp)           │
└─────────────────────────────────────┘
           │
           │ 1
           │
           │ ∞
           ▼
┌─────────────────────────────────────┐
│            SONGS                    │
├─────────────────────────────────────┤
│ PK  id (integer) AUTOINCREMENT      │
│     title (text) NOT NULL           │
│ UK  slug (text) NOT NULL            │
│     duration (integer)              │
│ FK  artistId (integer) NOT NULL ───┤
│ FK  albumId (integer) NULL ────────┤
│     releaseDate (timestamp)         │
│     lyrics (text)                   │
│     annotations (text/JSON)         │
│ UK  musicbrainzId (text)            │◄── Should be UNIQUE
│     isrc (text)                     │
│     wikidataId (text)               │
│     externalIds (text/JSON)         │
│     createdAt (timestamp)           │
│     updatedAt (timestamp)           │
└─────────────────────────────────────┘

## CURRENT SCHEMA (using MusicBrainz IDs as PKs)

```
┌─────────────────────────────────────┐
│            ARTISTS                  │
├─────────────────────────────────────┤
│ PK  id (text) - MusicBrainz ID     │◄── PROBLEM!
│     name (text) NOT NULL            │
│ UK  slug (text) NOT NULL            │
│ UK  urlSlug (text) NOT NULL         │
│     country (text)                  │
│     formedYear (integer)            │
│     genres (text/JSON)              │
│     bio (text)                      │
│     images (text/JSON)              │
│     wikidataId (text)               │
│     externalIds (text/JSON)         │
│     createdAt (timestamp)           │
│     updatedAt (timestamp)           │
└─────────────────────────────────────┘

Legend:
- PK = Primary Key
- FK = Foreign Key  
- UK = Unique Key

Relationships:
- Artists ──< Albums (One to Many)
- Artists ──< Songs (One to Many)
- Albums ──< Songs (One to Many, Optional)
```

## Key Points

1. **Primary Keys**: All use MusicBrainz IDs (UUIDs) as text
2. **Slugs**: URL-friendly identifiers (unique)
3. **JSON Fields**: genres, images, externalIds, annotations stored as text
4. **Optional Relations**: Songs can exist without albums (singles)
5. **Timestamps**: Auto-populated createdAt/updatedAt

## Proposed Addition: Artist Members Table

```
┌─────────────────────────────────────┐
│         ARTIST_MEMBERS              │
├─────────────────────────────────────┤
│ PK  id (integer) AUTOINCREMENT      │
│ FK  artistId (text) NOT NULL ──────┤
│     memberName (text) NOT NULL      │
│     memberMbid (text)               │
│     instruments (text)              │
│     beginDate (text)                │
│     endDate (text)                  │
│     isOriginalMember (integer)      │
│     createdAt (timestamp)           │
│     updatedAt (timestamp)           │
└─────────────────────────────────────┘
```