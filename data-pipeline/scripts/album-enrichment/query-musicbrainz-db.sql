-- Query to get canonical albums for artists in our staging database
-- This assumes you have artist MBIDs that we can look up

-- Get all release groups for an artist with their "best" release
WITH artist_release_groups AS (
  SELECT DISTINCT
    a.gid AS artist_mbid,
    a.name AS artist_name,
    rg.gid AS release_group_mbid,
    rg.name AS release_group_name,
    rg.type AS release_group_type,
    rgpt.name AS primary_type,
    string_agg(DISTINCT rgst.name, ', ') AS secondary_types
  FROM artist a
  JOIN artist_credit_name acn ON acn.artist = a.id
  JOIN artist_credit ac ON ac.id = acn.artist_credit
  JOIN release_group rg ON rg.artist_credit = ac.id
  LEFT JOIN release_group_primary_type rgpt ON rg.type = rgpt.id
  LEFT JOIN release_group_secondary_type_join rgstj ON rgstj.release_group = rg.id
  LEFT JOIN release_group_secondary_type rgst ON rgst.id = rgstj.secondary_type
  WHERE 
    -- Filter for specific artists (replace with your artist MBIDs)
    a.gid IN (
      'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d', -- The Beatles
      '83d91898-7763-47d7-b03b-b92132375c47', -- Pink Floyd
      '5441c29d-3602-4898-b1a1-b77fa23b8e50'  -- David Bowie
    )
    -- Only get albums (type 1 = album)
    AND rg.type = 1
  GROUP BY a.gid, a.name, rg.gid, rg.name, rg.type, rgpt.name
),
-- Get the "best" release for each release group
canonical_releases AS (
  SELECT DISTINCT ON (rg.gid)
    rg.gid AS release_group_mbid,
    r.gid AS release_mbid,
    r.name AS release_name,
    rl.date_year AS release_year,
    rl.date_month AS release_month,
    rl.date_day AS release_day,
    rs.name AS release_status,
    c.name AS country,
    r.barcode,
    m.track_count
  FROM release_group rg
  JOIN release r ON r.release_group = rg.id
  LEFT JOIN release_status rs ON r.status = rs.id
  LEFT JOIN release_label rl ON rl.release = r.id
  LEFT JOIN country c ON r.country = c.id
  LEFT JOIN medium m ON m.release = r.id
  WHERE 
    -- Only official releases
    (r.status = 1 OR r.status IS NULL)  -- 1 = Official
    -- Prefer releases with dates
    AND rl.date_year IS NOT NULL
  ORDER BY 
    rg.gid,
    -- Prioritize by status (official first)
    CASE WHEN r.status = 1 THEN 0 ELSE 1 END,
    -- Then by date (earliest)
    rl.date_year,
    rl.date_month NULLS LAST,
    rl.date_day NULLS LAST,
    -- Then by country (US/UK/Europe preferred)
    CASE 
      WHEN c.iso_code = 'GB' THEN 1
      WHEN c.iso_code = 'US' THEN 2
      WHEN c.iso_code = 'XE' THEN 3  -- Europe
      ELSE 4
    END,
    -- Finally by track count (prefer more complete)
    m.track_count DESC
)
-- Final query combining everything
SELECT 
  arg.artist_name,
  arg.artist_mbid,
  arg.release_group_name AS album_title,
  arg.release_group_mbid,
  cr.release_mbid AS canonical_release_mbid,
  cr.release_year,
  cr.country,
  cr.track_count,
  arg.secondary_types
FROM artist_release_groups arg
LEFT JOIN canonical_releases cr ON cr.release_group_mbid = arg.release_group_mbid
WHERE 
  -- Exclude compilations, live albums, soundtracks
  (arg.secondary_types IS NULL 
   OR NOT (
     arg.secondary_types LIKE '%Compilation%' 
     OR arg.secondary_types LIKE '%Live%'
     OR arg.secondary_types LIKE '%Soundtrack%'
   ))
ORDER BY 
  arg.artist_name,
  cr.release_year,
  arg.release_group_name;