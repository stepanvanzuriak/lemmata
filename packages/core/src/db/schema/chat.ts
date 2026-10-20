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

export const AGENT_ROLES = ["prover", "referee"] as const;
export const MESSAGE_ROLES = ["user", "assistant"] as const;

export const canvasAgent = sqliteTable(
  "canvas_agent",
  {
    id: text().primaryKey().$defaultFn(ulid),
    canvasId: text("canvas_id")
      .notNull()
      .references(() => canvas.id, { onDelete: "cascade" }),
    role: text({ enum: AGENT_ROLES }).notNull(),
    model: text(),
    tokenCap: integer("token_cap"),
    createdAt: text("created_at").notNull().$defaultFn(isoNow),
  },
  (table) => [
    uniqueIndex("canvas_agent_role_idx").on(table.canvasId, table.role),
  ],
);

export const chatMessage = sqliteTable(
  "chat_message",
  {
    id: text().primaryKey().$defaultFn(ulid),
    canvasId: text("canvas_id")
      .notNull()
      .references(() => canvas.id, { onDelete: "cascade" }),
    role: text({ enum: MESSAGE_ROLES }).notNull(),
    text: text().notNull(),
    attemptId: text("attempt_id").references(() => attempt.id, {
      onDelete: "set null",
    }),
    agentId: text("agent_id").references(() => canvasAgent.id, {
      onDelete: "set null",
    }),
    target: text(),
    /** The reset that hid this message from the chat; null while shown. */
    archivedBy: text("archived_by"),
    createdAt: text("created_at").notNull().$defaultFn(isoNow),
  },
  (table) => [
    index("chat_message_canvas_idx").on(table.canvasId, table.createdAt),
  ],
);

export const canvasAgentSchema = createSelectSchema(canvasAgent);
export const chatMessageSchema = createSelectSchema(chatMessage);

export type CanvasAgent = z.infer<typeof canvasAgentSchema>;
export type AgentRole = (typeof AGENT_ROLES)[number];
export type ChatMessage = z.infer<typeof chatMessageSchema>;
