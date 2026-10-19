CREATE TABLE `canvas_agent` (
	`id` text PRIMARY KEY,
	`canvas_id` text NOT NULL,
	`role` text NOT NULL,
	`model` text,
	`token_cap` integer,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_canvas_agent_canvas_id_canvas_id_fk` FOREIGN KEY (`canvas_id`) REFERENCES `canvas`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `chat_message` (
	`id` text PRIMARY KEY,
	`canvas_id` text NOT NULL,
	`role` text NOT NULL,
	`text` text NOT NULL,
	`attempt_id` text,
	`agent_id` text,
	`target` text,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_chat_message_canvas_id_canvas_id_fk` FOREIGN KEY (`canvas_id`) REFERENCES `canvas`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_chat_message_attempt_id_attempt_id_fk` FOREIGN KEY (`attempt_id`) REFERENCES `attempt`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_chat_message_agent_id_canvas_agent_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `canvas_agent`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `canvas_agent_role_idx` ON `canvas_agent` (`canvas_id`,`role`);--> statement-breakpoint
CREATE INDEX `chat_message_canvas_idx` ON `chat_message` (`canvas_id`,`created_at`);