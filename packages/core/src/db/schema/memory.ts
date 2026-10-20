import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createSelectSchema } from "drizzle-orm/zod";
import type { z } from "zod";
import { isoNow, ulid } from "../../ids.js";
import { attempt } from "./attempt.js";
import { canvas } from "./canvas.js";
import { project } from "./project.js";

export const MEMORY_KINDS = ["fact", "dead-end", "idea"] as const;

export const memoryEntry = sqliteTable(
  "memory_entry",
  {
    id: text().primaryKey().$defaultFn(ulid),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    canvasId: text("canvas_id").references(() => canvas.id, {
      onDelete: "set null",
    }),
    attemptId: text("attempt_id").references(() => attempt.id, {
      onDelete: "set null",
    }),
    kind: text({ enum: MEMORY_KINDS }).notNull(),
    text: text().notNull(),
    pinned: integer({ mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().$defaultFn(isoNow),
    updatedAt: text("updated_at").notNull().$defaultFn(isoNow),
  },
  (table) => [
    index("memory_entry_project_id_idx").on(table.projectId),
    uniqueIndex("memory_entry_project_text_idx").on(
      table.projectId,
      sql`lower(trim(${table.text}))`,
    ),
  ],
);

export const memoryEntrySchema = createSelectSchema(memoryEntry);

export type MemoryEntry = z.infer<typeof memoryEntrySchema>;
export type MemoryKind = (typeof MEMORY_KINDS)[number];
