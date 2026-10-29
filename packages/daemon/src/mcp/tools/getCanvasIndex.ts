import { z } from "zod";
import { clip } from "../../cards/describe.js";
import { fieldsOf, isArchived } from "../../cards/types.js";
import { guard, type RegisterTool } from "./shared.js";

const kinds = [
  "goal",
  "hypothesis",
  "attack",
  "statement",
  "note",
  "memory",
  "arxiv",
  "literature",
  "python",
  "lean",
  "toolbox",
] as const;

export const registerGetCanvasIndex: RegisterTool = (server, { detail }) => {
  server.registerTool(
    "get_canvas_index",
    {
      description:
        "Get a compact index of all cards on this canvas, optionally filtered by kind (card type). Returns every matching card's id, kind, title, label and status without bodies or pagination. Use get_card to read full content. Archived cards are hidden by default.",
      inputSchema: {
        kind: z
          .enum(kinds)
          .optional()
          .describe("Card type to list; omit for all types"),
        includeArchived: z.boolean().default(false),
      },
      annotations: { readOnlyHint: true },
    },
    ({ kind, includeArchived }) =>
      guard(async () => {
        const current = await detail();
        const cards = current.nodes
          .filter(
            (card) =>
              (!kind || card.kind === kind) &&
              (includeArchived || !isArchived(card)),
          )
          .map((card) => {
            const fields = fieldsOf(card);
            return {
              id: card.id,
              kind: card.kind,
              title: clip(fields.title ?? "", 160),
              ...(fields.label && { label: clip(fields.label, 40) }),
              ...(fields.status && { status: clip(fields.status, 40) }),
              ...(isArchived(card) && { archived: true }),
            };
          });
        return JSON.stringify({ total: cards.length, cards });
      }),
  );
};
