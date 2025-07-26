# Schema Recommendations for Additional Data

## Current Schema vs. Available Data

### Artists Table - Recommended Updates

**Add these specific fields:**
```sql
-- Social Media (commonly needed for frontend)
twitter VARCHAR(255),
instagram VARCHAR(255), 
facebook VARCHAR(255),
youtubeChannelId VARCHAR(255),

-- Streaming (for direct links)
appleMusicId VARCHAR(255),
tidalArtistId VARCHAR(255),
deezerArtistId VARCHAR(255),

-- Additional IDs
allMusicId VARCHAR(255),
viafId VARCHAR(255),  -- Virtual International Authority File
```

**Keep in JSON (externalIds):**
- imdbUrl
- soundcloudUrl
- bandcampId
- official homepages (can be multiple)
- fan pages
- BBC Music URL
- MusicMeter
- RateYourMusic
- All other niche database IDs

**New JSON field for relationships:**
```sql
relationships JSONB,  -- For complex relationships like:
-- - tribute artists
-- - founded companies
-- - rankings (Rolling Stone #1, etc)
-- - renamed from/to
-- - part of collections
```

### Why This Approach?

1. **Specific fields for common queries**: Things like social media and major streaming platforms will likely be queried/displayed frequently

2. **JSON for flexibility**: 
   - `externalIds` for all the various database IDs that we might need for entity resolution but won't query directly
   - `relationships` for complex, varied relationships that don't fit a simple foreign key model

3. **Members as separate table**: Since members have time periods, instruments, and their own MBIDs, they deserve their own table with proper foreign keys

### Example Members Table
```sql
CREATE TABLE artist_members (
  id INTEGER PRIMARY KEY,
  artistId INTEGER REFERENCES artists(id),
  memberName VARCHAR(255),
  memberMbid VARCHAR(255),
  instruments VARCHAR(255),
  beginDate DATE,
  endDate DATE,
  isOriginalMember BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

This gives us:
- Fast queries on popular fields
- Flexibility for uncommon data
- Proper relational modeling for members
- Room to grow without schema changes