import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Project } from "shared";
import { isoNow, ulid } from "../ids.js";

export const project = sqliteTable("project", {
  id: text().primaryKey().$defaultFn(ulid),
  title: text().notNull(),
  /** Markdown problem statement; becomes the goal card once canvases exist. */
  statement: text().notNull().default(""),
  /** Optional external folder the project's code runs in. */
  dir: text(),
  createdAt: text("created_at").notNull().$defaultFn(isoNow),
  updatedAt: text("updated_at").notNull().$defaultFn(isoNow),
});

export type ProjectRow = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;

// Compile-time guard: the table row must stay identical to the shared API type.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _projectMatchesShared: Exact<ProjectRow, Project> = true;
void _projectMatchesShared;
