# Data Pipeline Flow

```
┌─────────────────┐
│   MusicBrainz   │
│  (Start Here)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│ Fetch Artists   │────▶│ Popularity   │
│ by Popularity   │     │ Ranking      │
└────────┬────────┘     └──────────────┘
         │
         ▼
┌─────────────────┐
│ Extract Data:   │
│ - Basic Info    │
│ - External IDs  │
│ - Band Members  │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Store   │
    └────┬────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│ For Each Artist │────▶│ Get Albums   │
│                 │     │ (Canonical)  │
└────────┬────────┘     └──────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│ For Each Album  │────▶│ Get Songs    │
│                 │     │              │
└────────┬────────┘     └──────────────┘
         │
         ▼
┌─────────────────┐
│ Data Enrichment │
└────────┬────────┘
         │
    ┌────┴────┬────────┬────────┐
    ▼         ▼        ▼        ▼
┌────────┐┌────────┐┌────────┐┌────────┐
│Spotify ││Last.fm ││Discogs ││ Genius │
│--------││--------││--------││--------|
│Images  ││Bio     ││Images  ││Lyrics  │
│Streams ││Stats   ││Profile ││        │
└────────┘└────────┘└────────┘└────────┘
         │
         ▼
┌─────────────────┐
│ Final Database  │
└─────────────────┘
```

## Process Steps

1. **Artist Discovery** - Query MusicBrainz for popular artists
2. **Data Extraction** - Parse relationships, members, external IDs
3. **Album Collection** - Get canonical releases per artist
4. **Song Collection** - Get tracks per album
5. **Enrichment** - Fill gaps with other APIs
6. **Storage** - Save to staging database

## Current Status
- ✅ Steps 1-2 complete
- 🔄 Steps 3-6 pending