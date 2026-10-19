CREATE TABLE `attempt` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`canvas_id` text,
	`title` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`session_id` text,
	`model` text,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cache_read_tokens` integer DEFAULT 0 NOT NULL,
	`cache_write_tokens` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	CONSTRAINT `fk_attempt_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_attempt_canvas_id_canvas_id_fk` FOREIGN KEY (`canvas_id`) REFERENCES `canvas`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `attempt_project_id_idx` ON `attempt` (`project_id`);--> statement-breakpoint
CREATE INDEX `attempt_canvas_id_idx` ON `attempt` (`canvas_id`);