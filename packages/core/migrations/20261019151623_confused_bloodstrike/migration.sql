CREATE TABLE `canvas` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_canvas_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `canvas_edge` (
	`id` text PRIMARY KEY,
	`canvas_id` text NOT NULL,
	`from_node` text NOT NULL,
	`to_node` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_canvas_edge_canvas_id_canvas_id_fk` FOREIGN KEY (`canvas_id`) REFERENCES `canvas`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_canvas_edge_from_node_canvas_node_id_fk` FOREIGN KEY (`from_node`) REFERENCES `canvas_node`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_canvas_edge_to_node_canvas_node_id_fk` FOREIGN KEY (`to_node`) REFERENCES `canvas_node`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `canvas_node` (
	`id` text PRIMARY KEY,
	`canvas_id` text NOT NULL,
	`kind` text NOT NULL,
	`x` real DEFAULT 0 NOT NULL,
	`y` real DEFAULT 0 NOT NULL,
	`w` real DEFAULT 0 NOT NULL,
	`h` real DEFAULT 0 NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_by` text DEFAULT 'user' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_canvas_node_canvas_id_canvas_id_fk` FOREIGN KEY (`canvas_id`) REFERENCES `canvas`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `canvas_project_id_idx` ON `canvas` (`project_id`);--> statement-breakpoint
CREATE INDEX `canvas_edge_canvas_id_idx` ON `canvas_edge` (`canvas_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `canvas_edge_unique_idx` ON `canvas_edge` (`from_node`,`to_node`,`kind`);--> statement-breakpoint
CREATE INDEX `canvas_node_canvas_id_idx` ON `canvas_node` (`canvas_id`);