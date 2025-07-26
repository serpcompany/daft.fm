ALTER TABLE `artists` ADD `url_slug` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `artists_url_slug_unique` ON `artists` (`url_slug`);