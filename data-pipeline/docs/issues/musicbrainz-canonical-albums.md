# Explore MusicBrainz Canonical Data for Album Fetching

## Overview
MusicBrainz provides pre-curated "canonical" datasets that identify the most representative version of each release/album. This could be a cleaner approach than our current Spotify-based solution.

## Background
MusicBrainz contains many versions of the same release (remasters, regional variations, etc.). They've created canonical datasets to identify "the most representative version" - the one that "most people will think of".

## Resources

### Canonical Data Documentation
- Main docs: https://musicbrainz.org/doc/Canonical_MusicBrainz_data
- Downloads: https://data.metabrainz.org/pub/musicbrainz/canonical_data/
- Updated twice monthly, CC0 licensed

### Available Datasets
1. **Canonical Release Mapping** - Maps each release group to one canonical release
2. **Canonical Recording Mapping** - Maps recordings to their most representative version
3. **Combined Lookup** - For fuzzy matching metadata to MusicBrainz entries

### Python Package: musicbrainzngs
- Docs: https://python-musicbrainzngs.readthedocs.io/
- Install: `pip install musicbrainzngs`
- Supports browsing release groups with pagination
- Can filter by release type (album, single, EP, etc.)

## Approaches to Explore

### Option 1: Use Pre-built Canonical Dataset
```python
# Download canonical_release_redirect.csv.gz (likely large)
# Map our artists' release groups to canonical releases
# Pros: Official MusicBrainz curation
# Cons: Need to download/update large dataset
```

### Option 2: API-based Approach
```python
import musicbrainzngs

musicbrainzngs.set_useragent("DaftFM", "1.0", "https://daft.fm")

# Browse release groups for artist
result = musicbrainzngs.browse_release_groups(
    artist=artist_mbid,
    release_type=["album"],  # Only studio albums
    limit=100,
    offset=0
)

# For each release group, we'd need to either:
# 1. Use canonical dataset to find best release
# 2. Apply our own logic (earliest, most countries, etc.)
```

## Advantages over Current Spotify Approach
1. **Better metadata**: MusicBrainz has richer data (release dates, countries, formats)
2. **Release groups**: Already grouped by "same album" concept
3. **Community curated**: Canonical mappings maintained by experts
4. **No duplicates**: Release groups inherently deduplicate versions

## Next Steps
1. Test musicbrainzngs to browse release groups for our artists
2. Evaluate canonical dataset size and update frequency
3. Compare results with our Spotify approach
4. Decide whether to switch or combine approaches

## Questions to Answer
- How large is the canonical dataset? Can we use it selectively?
- How stable are canonical mappings between updates?
- Should we use release groups directly or map to canonical releases?
- Can we combine this with Spotify for best of both worlds?

## Implementation Sketch
```python
# Potential hybrid approach:
# 1. Get release groups from MusicBrainz (authoritative structure)
# 2. Map to Spotify albums for streaming metadata
# 3. Use canonical dataset for disambiguation if needed
```