-- Rename popularity fields to include source prefix
ALTER TABLE artists RENAME COLUMN popularity TO spotify_popularity;
ALTER TABLE artists RENAME COLUMN listeners TO lastfm_listeners;
ALTER TABLE artists RENAME COLUMN playcount TO lastfm_playcount;
