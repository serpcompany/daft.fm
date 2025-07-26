CREATE TABLE `albums` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`artist_id` integer NOT NULL,
	`release_date` integer,
	`track_count` integer,
	`genres` text,
	`cover_art` text,
	`credits` text,
	`musicbrainz_release_id` text,
	`wikidata_id` text,
	`discogs_master_id` text,
	`discogs_release_id` text,
	`spotify_album_id` text,
	`barcode` text,
	`catalog_number` text,
	`external_ids` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `albums_slug_unique` ON `albums` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `albums_musicbrainz_release_id_unique` ON `albums` (`musicbrainz_release_id`);--> statement-breakpoint
CREATE TABLE `artist_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`artist_id` integer NOT NULL,
	`member_name` text NOT NULL,
	`member_mbid` text,
	`instruments` text,
	`begin_date` text,
	`end_date` text,
	`is_original_member` integer DEFAULT false,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `artists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`url_slug` text NOT NULL,
	`country` text,
	`formed_year` integer,
	`genres` text,
	`members` text,
	`bio` text,
	`images` text,
	`musicbrainz_id` text,
	`wikidata_id` text,
	`discogs_artist_id` text,
	`spotify_artist_id` text,
	`lastfm_url` text,
	`isni` text,
	`external_ids` text,
	`twitter` text,
	`instagram` text,
	`facebook` text,
	`youtube_channel_id` text,
	`popularity_score` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artists_slug_unique` ON `artists` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `artists_url_slug_unique` ON `artists` (`url_slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `artists_musicbrainz_id_unique` ON `artists` (`musicbrainz_id`);--> statement-breakpoint
CREATE TABLE `songs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`duration` integer,
	`artist_id` integer NOT NULL,
	`album_id` integer,
	`release_date` integer,
	`lyrics` text,
	`annotations` text,
	`credits` text,
	`musicbrainz_recording_id` text,
	`wikidata_id` text,
	`isrc` text,
	`spotify_track_id` text,
	`genius_song_id` text,
	`acoustid` text,
	`external_ids` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `songs_musicbrainz_recording_id_unique` ON `songs` (`musicbrainz_recording_id`);