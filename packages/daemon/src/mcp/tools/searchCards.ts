import { z } from "zod";
import type { CanvasNode } from "shared";
import { clip } from "../../cards/describe.js";
import { fieldsOf, isArchived } from "../../cards/types.js";
import { guard, type RegisterTool } from "./shared.js";

export const searchFilters = {
  query: z.string().trim().max(500).optional(),
  kind: z
    .string()
    .optional()
    .describe("Filter by card kind, e.g. python or hypothesis"),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
  includeArchived: z.boolean().default(false),
};

type Filters = {
  query?: string;
  kind?: string;
  includeArchived: boolean;
};

/** Cards matching a case-insensitive substring over ids, labels, titles, text and code. */
export function matchCards(nodes: CanvasNode[], filters: Filters) {
  const wanted = (filters.query ?? "").toLowerCase();

  return nodes.flatMap((card) => {
    if (
      (!filters.includeArchived && isArchived(card)) ||
      (filters.kind && card.kind !== filters.kind)
    ) {
      return [];
    }
    const p = fieldsOf(card);
    const fields = [
      card.id,
      p.label,
      p.title,
      p.text,
      p.markdown,
      p.source,
      p.python,
      p.lean,
    ];
    const match = wanted
      ? fields.find(
          (value) =>
            typeof value === "string" && value.toLowerCase().includes(wanted),
        )
      : undefined;
    return wanted && !match ? [] : [{ card, match }];
  });
}

export function summarizeCard(
  { card, match }: ReturnType<typeof matchCards>[number],
  query?: string,
) {
  const p = fieldsOf(card);
  const start = match
    ? Math.max(0, match.toLowerCase().indexOf((query ?? "").toLowerCase()) - 40)
    : 0;

  return {
    id: card.id,
    kind: card.kind,
    title: clip(p.title ?? "", 160),
    ...(p.label && { label: clip(p.label, 40) }),
    ...(p.status && { status: clip(p.status, 40) }),
    ...(isArchived(card) && { archived: true }),
    ...(match &&
      match !== p.title &&
      match !== p.label &&
      match !== card.id && {
        snippet: `${start > 0 ? "..." : ""}${clip(match.slice(start), 160)}`,
      }),
  };
}

export const registerSearchCards: RegisterTool = (server, { detail }) => {
  server.registerTool(
    "search_cards",
    {
      description:
        "Search this canvas's cards without reading full bodies or links. Case-insensitive substring search across ids, labels, titles, text, markdown and code. Omit query for a compact card index. Returns bounded metadata and matching snippets; use get_card for full content. Archived cards are hidden by default. To look beyond this canvas, use search_project_cards.",
      inputSchema: searchFilters,
      annotations: { readOnlyHint: true },
    },
    ({ query, kind, limit, offset, includeArchived }) =>
      guard(async () => {
        const current = await detail();
        const matches = matchCards(current.nodes, {
          query,
          kind,
          includeArchived,
        });
        const cards = matches
          .slice(offset, offset + limit)
          .map((match) => summarizeCard(match, query));
        return JSON.stringify({
          total: matches.length,
          cards,
          nextOffset:
            offset + cards.length < matches.length
              ? offset + cards.length
              : null,
        });
      }),
  );
};
