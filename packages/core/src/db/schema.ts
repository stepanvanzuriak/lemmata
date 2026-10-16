import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { isoNow, ulid } from "../ids.js";

export const project = sqliteTable("project", {
  id: text().primaryKey().$defaultFn(ulid),
  title: text().notNull(),
  statement: text().notNull().default(""),
  dir: text(),
  createdAt: text("created_at").notNull().$defaultFn(isoNow),
  updatedAt: text("updated_at").notNull().$defaultFn(isoNow),
});

export type ProjectRow = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;
