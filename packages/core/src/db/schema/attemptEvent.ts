import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { isoNow } from "../../ids.js";
import { attempt } from "./attempt.js";

export const attemptEvent = sqliteTable(
  "attempt_event",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => attempt.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    data: text().notNull(),
    createdAt: text("created_at").notNull().$defaultFn(isoNow),
  },
  (table) => [
    index("attempt_event_attempt_id_idx").on(table.attemptId, table.id),
  ],
);
