import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createSelectSchema } from "drizzle-orm/zod";
import type { z } from "zod";
import { isoNow, ulid } from "../../ids.js";
import { canvas } from "./canvas.js";
import { project } from "./project.js";

export const ATTEMPT_STATUSES = [
  "running",
  "done",
  "error",
  "aborted",
  "stopped_budget",
] as const;

export const attempt = sqliteTable(
  "attempt",
  {
    id: text().primaryKey().$defaultFn(ulid),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    canvasId: text("canvas_id").references(() => canvas.id, {
      onDelete: "set null",
    }),
    title: text().notNull().default(""),
    status: text({ enum: ATTEMPT_STATUSES }).notNull().default("running"),
    sessionId: text("session_id"),
    model: text(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    startedAt: text("started_at").notNull().$defaultFn(isoNow),
    finishedAt: text("finished_at"),
  },
  (table) => [
    index("attempt_project_id_idx").on(table.projectId),
    index("attempt_canvas_id_idx").on(table.canvasId),
  ],
);

export const attemptSchema = createSelectSchema(attempt);

export type Attempt = z.infer<typeof attemptSchema>;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];
