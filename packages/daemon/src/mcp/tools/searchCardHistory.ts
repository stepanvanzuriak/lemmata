import { listAgents, listCardExchanges, type ChatMessage } from "core";
import { z } from "zod";
import { clip } from "../../cards/describe.js";
import { cardRef, guard, type RegisterTool } from "./shared.js";

const REQUEST_CHARS = 300;
const REPLY_CHARS = 1_500;
const SNIPPET_CHARS = 600;

/** The text around the first match, or the start of the text when there is none. */
function excerpt(text: string, wanted: string, max: number) {
  const at = wanted ? text.toLowerCase().indexOf(wanted) : -1;
  if (at < 0) {
    return clip(text, max);
  }
  const start = Math.max(0, at - SNIPPET_CHARS / 3);
  const end = Math.min(text.length, start + SNIPPET_CHARS);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

export const registerSearchCardHistory: RegisterTool = (
  server,
  { db, run, find },
) => {
  server.registerTool(
    "search_card_history",
    {
      description:
        "Search the chat history of one card: earlier agent runs that targeted it or changed it, each as the request and the agent's final reply. Use it to learn what was already tried on a card before starting again. Case-insensitive substring search over requests and replies; omit query to list the newest runs. Includes runs from before a canvas reset.",
      inputSchema: {
        id: cardRef,
        query: z.string().trim().max(500).optional(),
        limit: z.number().int().min(1).max(20).default(5),
        offset: z.number().int().min(0).default(0),
      },
      annotations: { readOnlyHint: true },
    },
    ({ id, query, limit, offset }) =>
      guard(async () => {
        const { card } = await find(id);
        const wanted = (query ?? "").toLowerCase();
        const roles = new Map(
          (await listAgents(db, run.canvasId)).map((a) => [a.id, a.role]),
        );
        const includes = (m: ChatMessage | null) =>
          Boolean(m?.text.toLowerCase().includes(wanted));
        const matches = (await listCardExchanges(db, run.canvasId, card.id))
          // The run asking this question is not history yet.
          .filter((e) => !run.requestId || e.request?.id !== run.requestId)
          .filter((e) => !wanted || includes(e.request) || includes(e.reply))
          .reverse();

        const exchanges = matches.slice(offset, offset + limit).map((e) => {
          const first = e.request ?? e.reply!;
          return {
            at: first.createdAt,
            agent: (first.agentId && roles.get(first.agentId)) || "assistant",
            ...(first.target &&
              first.target !== card.id && { target: first.target }),
            ...((e.request?.archivedBy || e.reply?.archivedBy) && {
              beforeReset: true,
            }),
            request: e.request
              ? excerpt(e.request.text, wanted, REQUEST_CHARS)
              : null,
            reply: e.reply ? excerpt(e.reply.text, wanted, REPLY_CHARS) : null,
          };
        });

        return JSON.stringify({
          card: card.id,
          total: matches.length,
          exchanges,
          nextOffset:
            offset + exchanges.length < matches.length
              ? offset + exchanges.length
              : null,
        });
      }),
  );
};
