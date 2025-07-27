# Explore MusicBrainz Database for Canonical Albums

## Overview
We have a MusicBrainz server running on our infrastructure that we can query directly for canonical album data. This could provide cleaner results than our current Spotify approach.

## Database Connection Details
```bash
Host: localhost (from outside docker)
Port: 5997
Database: musicbrainz
User: musicbrainz (or postgres for admin)
Password: musicbrainzXasd7yX

# Environment variables for scripts:
export MUSICBRAINZ_DB_HOST=localhost
export MUSICBRAINZ_DB_PORT=5997
export MUSICBRAINZ_DB_NAME=musicbrainz
export MUSICBRAINZ_DB_USER=musicbrainz
export MUSICBRAINZ_DB_PASSWORD=musicbrainzXasd7yX
```

## Advantages of Direct DB Access
1. **No API rate limits** - Can query as fast as needed
2. **Complex filtering** - Use SQL to filter exactly what we want
3. **Canonical selection** - Can implement sophisticated logic to pick the "best" release
4. **Already available** - No need to download 2GB canonical dataset

## Implementation Approach

### 1. Query Release Groups (Albums)
```sql
-- Get all album release groups for an artist
SELECT rg.gid, rg.name, rg.type
FROM release_group rg
JOIN artist_credit ac ON rg.artist_credit = ac.id
JOIN artist_credit_name acn ON ac.id = acn.artist_credit
JOIN artist a ON acn.artist = a.id
WHERE a.gid = 'ARTIST_MBID' 
  AND rg.type = 1  -- 1 = Album
```

### 2. Find Canonical Release per Release Group
For each release group, select the "best" release based on:
- Official status (not promotional/bootleg)
- Release date (prefer earliest)
- Country (prioritize UK for UK artists, US for US artists)
- Completeness (track count, has barcode, etc.)

### 3. Filter Out Non-Studio Albums
Exclude releases with secondary types:
- Compilation
- Live
- Soundtrack
- Remix
- DJ-mix

## Scripts Created
1. `scripts/album-enrichment/query-musicbrainz-db.sql` - SQL query for canonical albums
2. `scripts/album-enrichment/query-musicbrainz-canonical.ts` - TypeScript implementation

## Testing Steps
1. Install PostgreSQL client: `pnpm add pg @types/pg`
2. Test connection: `npx tsx scripts/album-enrichment/query-musicbrainz-canonical.ts test`
3. Run full comparison: `npx tsx scripts/album-enrichment/query-musicbrainz-canonical.ts`

## Expected Results
Should return ~10-20 studio albums per major artist (vs 100+ from API without filtering)

## Questions to Answer
1. How does this compare to our Spotify results?
2. Is the additional complexity worth it?
3. Should we use this as primary source or for validation?
4. Can we match these to Spotify albums for best of both worlds?

## Next Steps
- [ ] Test the script with our database
- [ ] Compare results with current Spotify approach
- [ ] Decide whether to switch approaches
- [ ] If yes, implement full pipeline with MusicBrainz as source