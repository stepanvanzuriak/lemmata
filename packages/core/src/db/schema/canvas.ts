import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import type { z } from "zod";
import { isoNow, ulid } from "../../ids.js";
import { project } from "./project.js";

export const NODE_CREATORS = ["user", "ai"] as const;

export const EDGE_KINDS = [
  "depends-on",
  "checked-by",
  "refuted-by",
  "tested-by",
  "used-by",
] as const;

export const canvas = sqliteTable(
  "canvas",
  {
    id: text().primaryKey().$defaultFn(ulid),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text().notNull().default(""),
    createdAt: text("created_at").notNull().$defaultFn(isoNow),
    updatedAt: text("updated_at").notNull().$defaultFn(isoNow),
  },
  (table) => [index("canvas_project_id_idx").on(table.projectId)],
);

export const canvasNode = sqliteTable(
  "canvas_node",
  {
    id: text().primaryKey().$defaultFn(ulid),
    canvasId: text("canvas_id")
      .notNull()
      .references(() => canvas.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    x: real().notNull().default(0),
    y: real().notNull().default(0),
    w: real().notNull().default(0),
    h: real().notNull().default(0),
    collapsed: integer({ mode: "boolean" }).notNull().default(false),
    payload: text().notNull().default("{}"),
    createdBy: text("created_by", { enum: NODE_CREATORS })
      .notNull()
      .default("user"),
    createdAt: text("created_at").notNull().$defaultFn(isoNow),
    updatedAt: text("updated_at").notNull().$defaultFn(isoNow),
  },
  (table) => [index("canvas_node_canvas_id_idx").on(table.canvasId)],
);

export const canvasEdge = sqliteTable(
  "canvas_edge",
  {
    id: text().primaryKey().$defaultFn(ulid),
    canvasId: text("canvas_id")
      .notNull()
      .references(() => canvas.id, { onDelete: "cascade" }),
    fromNode: text("from_node")
      .notNull()
      .references(() => canvasNode.id, { onDelete: "cascade" }),
    toNode: text("to_node")
      .notNull()
      .references(() => canvasNode.id, { onDelete: "cascade" }),
    kind: text({ enum: EDGE_KINDS }).notNull(),
    createdAt: text("created_at").notNull().$defaultFn(isoNow),
    updatedAt: text("updated_at").notNull().$defaultFn(isoNow),
  },
  (table) => [
    index("canvas_edge_canvas_id_idx").on(table.canvasId),
    uniqueIndex("canvas_edge_unique_idx").on(
      table.fromNode,
      table.toNode,
      table.kind,
    ),
  ],
);

export const canvasSchema = createSelectSchema(canvas);
export const creteCanvasSchema = createInsertSchema(canvas);

export const nodeSchema = createSelectSchema(canvasNode);
export const createNodeSchema = createInsertSchema(canvasNode);
export const updateNodeSchema = createNodeSchema.partial();

export const edgeSchema = createSelectSchema(canvasEdge);
export const createEdgeSchema = createInsertSchema(canvasEdge);

export type Canvas = z.infer<typeof canvasSchema>;
export type CreateCanvasInput = z.input<typeof creteCanvasSchema>;

export type CanvasNode = z.infer<typeof nodeSchema>;
export type CreateCanvasNodeInput = z.input<typeof createNodeSchema>;
export type UpdateCanvasNodeInput = z.input<typeof updateNodeSchema>;

export type CanvasEdge = z.infer<typeof edgeSchema>;
export type CreateCanvasEdgeInput = z.input<typeof createEdgeSchema>;
