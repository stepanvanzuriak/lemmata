CREATE TABLE `memory_entry` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`canvas_id` text,
	`attempt_id` text,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_memory_entry_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_memory_entry_canvas_id_canvas_id_fk` FOREIGN KEY (`canvas_id`) REFERENCES `canvas`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_memory_entry_attempt_id_attempt_id_fk` FOREIGN KEY (`attempt_id`) REFERENCES `attempt`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `memory_entry_project_id_idx` ON `memory_entry` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `memory_entry_project_text_idx` ON `memory_entry` (`project_id`,lower(trim("text")));