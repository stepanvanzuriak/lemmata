import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import type { z } from "zod";
import { isoNow, ulid } from "../../ids.js";

export const project = sqliteTable("project", {
  id: text().primaryKey().$defaultFn(ulid),
  title: text().notNull(),
  statement: text().notNull().default(""),
  dir: text(),
  createdAt: text("created_at").notNull().$defaultFn(isoNow),
  updatedAt: text("updated_at").notNull().$defaultFn(isoNow),
});

export const projectSchema = createSelectSchema(project);

export const createProjectSchema = createInsertSchema(project, {
  title: (title) => title.trim().min(1, "title is required"),
  statement: (statement) => statement.trim(),
  dir: (dir) => dir.trim().transform((value) => value || null),
})
  .pick({ title: true, statement: true, dir: true })
  .partial({ statement: true, dir: true });

export const updateProjectSchema = createProjectSchema.partial();

export type Project = z.infer<typeof projectSchema>;
export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
