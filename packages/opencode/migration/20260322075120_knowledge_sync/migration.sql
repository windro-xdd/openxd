CREATE TABLE `knowledge_chunk` (
	`id` text PRIMARY KEY,
	`document_id` text NOT NULL,
	`kind` text NOT NULL,
	`path` text NOT NULL,
	`version` integer NOT NULL,
	`ordinal` integer NOT NULL,
	`heading` text,
	`raw` text NOT NULL,
	`raw_hash` text NOT NULL,
	`tokens` integer,
	`start_line` integer,
	`end_line` integer,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_knowledge_chunk_document_id_knowledge_document_id_fk` FOREIGN KEY (`document_id`) REFERENCES `knowledge_document`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `knowledge_document` (
	`id` text PRIMARY KEY,
	`kind` text NOT NULL,
	`path` text NOT NULL,
	`title` text,
	`source` text NOT NULL,
	`version` integer NOT NULL,
	`raw` text NOT NULL,
	`raw_hash` text NOT NULL,
	`metadata` text,
	`sync_state` text NOT NULL,
	`sync_error` text,
	`sync_cursor` text,
	`conflict_state` text NOT NULL,
	`conflict_raw` text,
	`conflict_hash` text,
	`time_source_updated` integer,
	`time_synced` integer,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `knowledge_chunk_document_idx` ON `knowledge_chunk` (`document_id`);--> statement-breakpoint
CREATE INDEX `knowledge_chunk_kind_idx` ON `knowledge_chunk` (`kind`);--> statement-breakpoint
CREATE INDEX `knowledge_chunk_path_idx` ON `knowledge_chunk` (`path`);--> statement-breakpoint
CREATE INDEX `knowledge_chunk_hash_idx` ON `knowledge_chunk` (`raw_hash`);--> statement-breakpoint
CREATE INDEX `knowledge_chunk_version_idx` ON `knowledge_chunk` (`version`);--> statement-breakpoint
CREATE INDEX `knowledge_chunk_updated_idx` ON `knowledge_chunk` (`time_updated`);--> statement-breakpoint
CREATE INDEX `knowledge_chunk_document_order_idx` ON `knowledge_chunk` (`document_id`,`ordinal`);--> statement-breakpoint
CREATE INDEX `knowledge_document_path_idx` ON `knowledge_document` (`path`);--> statement-breakpoint
CREATE INDEX `knowledge_document_kind_idx` ON `knowledge_document` (`kind`);--> statement-breakpoint
CREATE INDEX `knowledge_document_kind_path_idx` ON `knowledge_document` (`kind`,`path`);--> statement-breakpoint
CREATE INDEX `knowledge_document_hash_idx` ON `knowledge_document` (`raw_hash`);--> statement-breakpoint
CREATE INDEX `knowledge_document_version_idx` ON `knowledge_document` (`version`);--> statement-breakpoint
CREATE INDEX `knowledge_document_updated_idx` ON `knowledge_document` (`time_updated`);--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS `knowledge_chunk_fts` USING fts5(
	`raw`,
	`heading`,
	`path`,
	`kind`,
	content='knowledge_chunk',
	content_rowid='rowid'
);--> statement-breakpoint
INSERT INTO `knowledge_chunk_fts` (`rowid`, `raw`, `heading`, `path`, `kind`)
SELECT
	`rowid`,
	`raw`,
	coalesce(`heading`, ''),
	`path`,
	`kind`
FROM `knowledge_chunk`;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `knowledge_chunk_ai` AFTER INSERT ON `knowledge_chunk` BEGIN
	INSERT INTO `knowledge_chunk_fts` (`rowid`, `raw`, `heading`, `path`, `kind`)
	VALUES (new.`rowid`, new.`raw`, coalesce(new.`heading`, ''), new.`path`, new.`kind`);
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `knowledge_chunk_ad` AFTER DELETE ON `knowledge_chunk` BEGIN
	INSERT INTO `knowledge_chunk_fts` (`knowledge_chunk_fts`, `rowid`, `raw`, `heading`, `path`, `kind`)
	VALUES ('delete', old.`rowid`, old.`raw`, coalesce(old.`heading`, ''), old.`path`, old.`kind`);
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `knowledge_chunk_au` AFTER UPDATE ON `knowledge_chunk` BEGIN
	INSERT INTO `knowledge_chunk_fts` (`knowledge_chunk_fts`, `rowid`, `raw`, `heading`, `path`, `kind`)
	VALUES ('delete', old.`rowid`, old.`raw`, coalesce(old.`heading`, ''), old.`path`, old.`kind`);
	INSERT INTO `knowledge_chunk_fts` (`rowid`, `raw`, `heading`, `path`, `kind`)
	VALUES (new.`rowid`, new.`raw`, coalesce(new.`heading`, ''), new.`path`, new.`kind`);
END;
