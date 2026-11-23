import { deleteEdge, EDGE_KINDS } from "core";
import type { CanvasNode } from "shared";
import { z } from "zod";
import { fieldsOf, isArchived, ToolRefusal } from "../../cards/types.js";
import { cardRef, guard, type RegisterTool } from "./shared.js";

const nameOf = (card: CanvasNode) =>
  fieldsOf(card).label ?? `"${fieldsOf(card).title ?? card.id}"`;

export const registerDisconnectCards: RegisterTool = (server, { db, find }) => {
  server.registerTool(
    "disconnect_cards",
    {
      description:
        "Remove the links between two cards, in either direction. Pass kind to remove only that kind. Use for wrong or stale links, such as a check that no longer tests the claim. Refused for links of a supported hypothesis. Archiving a card does not remove its links.",
      inputSchema: {
        from: cardRef,
        to: cardRef,
        kind: z.enum(EDGE_KINDS).optional(),
        reason: z
          .string()
          .min(1)
          .describe('Short, such as "A397 checks a different statement"'),
      },
    },
    ({ from, to, kind }) =>
      guard(async () => {
        const { card: source, current } = await find(from);
        const target = (await find(to)).card;

        const supported = [source, target].find(
          (card) =>
            card.kind === "hypothesis" &&
            !isArchived(card) &&
            fieldsOf(card).status === "supported",
        );
        if (supported) {
          throw new ToolRefusal(
            `${nameOf(supported)} is supported; its links are its evidence and stay.`,
          );
        }

        const edges = current.edges.filter(
          (e) =>
            ((e.fromNode === source.id && e.toNode === target.id) ||
              (e.fromNode === target.id && e.toNode === source.id)) &&
            (!kind || e.kind === kind),
        );
        if (edges.length === 0) {
          throw new ToolRefusal(
            `No ${kind ? `${kind} ` : ""}link between ${nameOf(source)} and ${nameOf(target)}.`,
          );
        }

        for (const edge of edges) {
          await deleteEdge(db, edge.id);
        }
        const kinds = [...new Set(edges.map((e) => e.kind))].join(", ");
        return `Removed ${edges.length} link${edges.length === 1 ? "" : "s"} (${kinds}) between ${nameOf(source)} and ${nameOf(target)}.`;
      }),
  );
};
