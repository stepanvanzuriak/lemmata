CREATE TABLE `project` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`statement` text DEFAULT '' NOT NULL,
	`dir` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
