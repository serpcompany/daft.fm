# Artist Fetch Report - MusicBrainz Popularity Ranking

## Summary
- **Total Artists Fetched**: 10
- **Date**: 2025-01-26
- **Ranking Method**: Relationship count + (Tag count × 2)

## Top 10 Artists by Popularity Score

| Rank | Artist | Country | Score | Relationships | Tags | External IDs |
|------|--------|---------|-------|---------------|------|--------------|
| 1 | Lana Del Rey | US | 130 | 94 | 18 | 5 |
| 2 | David Bowie | GB | 116 | 76 | 20 | 5 |
| 3 | 植松伸夫 (Nobuo Uematsu) | JP | 107 | 55 | 26 | 5 |
| 4 | Madonna | US | 107 | 75 | 16 | 5 |
| 5 | The Beatles | GB | 102 | 66 | 18 | 5 |
| 6 | Elvis Presley | US | 100 | 62 | 19 | 5 |
| 7 | U2 | IE | 100 | 70 | 15 | 5 |
| 8 | Prince | US | 99 | 65 | 17 | 5 |
| 9 | Depeche Mode | GB | 99 | 73 | 13 | 5 |
| 10 | Eminem | US | 99 | 65 | 17 | 5 |

## Observations

### Popularity Scoring
- The scoring formula (relationships + tags×2) seems to effectively identify popular artists
- All top 10 artists have significant relationship counts (55-94)
- Tag counts vary from 13-26, providing genre diversity

### Geographic Distribution
- US: 5 artists (50%)
- GB: 3 artists (30%)
- JP: 1 artist (10%)
- IE: 1 artist (10%)

### External IDs
- All artists have exactly 5 external IDs captured
- Common IDs include: Spotify, Discogs, Wikidata, Last.fm, and others

### Genre Coverage
- Rock/Pop: Beatles, U2, David Bowie
- Electronic: Depeche Mode, Madonna (partial)
- Hip-Hop: Eminem
- Classical/Game Music: Nobuo Uematsu
- Alternative: Lana Del Rey

## Next Steps
1. ✅ Successfully fetches artists by popularity
2. ✅ Collects available data points (name, country, year, genres, external IDs)
3. ✅ Allows configurable artist count
4. 🔄 Need to implement album fetching
5. 🔄 Need to implement song fetching
6. 🔄 Need to add data persistence/storage