import { listCanvases } from "core";
import { loadDetail } from "../../cards/load.js";
import { matchCards, searchFilters, summarizeCard } from "./searchCards.js";
import { guard, type RegisterTool } from "./shared.js";

export const registerSearchProjectCards: RegisterTool = (
  server,
  { db, detail },
) => {
  server.registerTool(
    "search_project_cards",
    {
      description:
        "Search cards across every canvas of this project, including branches and the main canvas. Same matching as search_cards (case-insensitive substring over ids, labels, titles, text, markdown and code; omit query for an index), but each result carries its canvasId and canvasTitle. Results are read-only snippets; get_card only opens cards on this canvas. Archived cards are hidden by default.",
      inputSchema: searchFilters,
      annotations: { readOnlyHint: true },
    },
    ({ query, kind, limit, offset, includeArchived }) =>
      guard(async () => {
        const { canvas } = await detail();
        const canvases = await listCanvases(db, canvas.projectId);
        const details = await Promise.all(
          canvases.map((c) =>
            c.id === canvas.id ? detail() : loadDetail(db, c.id),
          ),
        );
        const matches = details.flatMap((d) =>
          matchCards(d.nodes, { query, kind, includeArchived }).map((m) => ({
            ...m,
            canvasId: d.canvas.id,
            canvasTitle: d.canvas.title || "Main canvas",
          })),
        );
        const cards = matches
          .slice(offset, offset + limit)
          .map(({ canvasId, canvasTitle, ...m }) => ({
            canvasId,
            canvasTitle,
            current: canvasId === canvas.id || undefined,
            ...summarizeCard(m, query),
          }));
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
