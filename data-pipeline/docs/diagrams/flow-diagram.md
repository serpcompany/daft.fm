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
│                 │     │ (Spotify API)│
└────────┬────────┘     └──────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│ For Each Album  │────▶│ Get Songs    │
│                 │     │ (Spotify API)│
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
3. **Album Collection** - Get canonical albums from Spotify API
4. **Song Collection** - Get tracks from Spotify API
5. **Enrichment** - Fill gaps with other APIs
6. **Storage** - Save to staging database

## Current Status
- ✅ Step 1-2: MusicBrainz artist discovery complete
- ✅ Step 3: Spotify album fetching implemented
- 🔄 Step 4: Song collection pending
- 🔄 Step 5-6: Enrichment & final storage pending