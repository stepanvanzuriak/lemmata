CREATE TABLE `attempt_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`attempt_id` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_attempt_event_attempt_id_attempt_id_fk` FOREIGN KEY (`attempt_id`) REFERENCES `attempt`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `attempt_event_attempt_id_idx` ON `attempt_event` (`attempt_id`,`id`);