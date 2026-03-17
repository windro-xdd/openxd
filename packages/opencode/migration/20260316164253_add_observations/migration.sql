CREATE TABLE `observation` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`tool` text NOT NULL,
	`type` text NOT NULL,
	`summary` text NOT NULL,
	`content` text,
	`tags` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_observation_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_observation_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `observation_project_idx` ON `observation` (`project_id`);--> statement-breakpoint
CREATE INDEX `observation_session_idx` ON `observation` (`session_id`);--> statement-breakpoint
CREATE INDEX `observation_type_idx` ON `observation` (`type`);--> statement-breakpoint
CREATE INDEX `observation_created_idx` ON `observation` (`time_created`);