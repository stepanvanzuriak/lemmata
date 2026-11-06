import {
  and,
  asc,
  desc,
  eq,
  isNotNull,
  isNull,
  lt,
  lte,
  like,
  or,
  sql,
} from "drizzle-orm";
import type { Db } from "./db/index.js";
import {
  attempt,
  chatMessage,
  type CardExchange,
  type ChatMessage,
} from "./db/schema.js";
import { isoNow } from "./ids.js";

export async function addMessage(
  db: Db,
  input: {
    canvasId: string;
    role: ChatMessage["role"];
    text: string;
    attemptId?: string | null;
    agentId?: string | null;
    target?: string | null;
    cards?: string[] | null;
  },
): Promise<ChatMessage> {
  const [row] = await db
    .insert(chatMessage)
    .values({ ...input, createdAt: isoNow() })
    .returning();
  return row!;
}

/** All visible messages, oldest first; with `limit`, the newest ones (before the message id `before`). */
export async function listMessages(
  db: Db,
  canvasId: string,
  page: { limit?: number; before?: string } = {},
): Promise<ChatMessage[]> {
  if (page.limit === undefined) {
    return db.query.chatMessage.findMany({
      where: { canvasId, archivedBy: { isNull: true } },
      orderBy: { createdAt: "asc" },
    });
  }

  const rows = await db.query.chatMessage.findMany({
    where: {
      canvasId,
      archivedBy: { isNull: true },
      ...(page.before ? { id: { lt: page.before } } : {}),
    },
    orderBy: { createdAt: "desc", id: "desc" },
    limit: page.limit,
  });

  return rows.reverse();
}

/** Hides the chat before `before` (a message id), so a reset starts a fresh conversation. */
export async function archiveMessages(
  db: Db,
  canvasId: string,
  before: string,
  by: string,
): Promise<number> {
  const rows = await db
    .update(chatMessage)
    .set({ archivedBy: by })
    .where(
      and(
        eq(chatMessage.canvasId, canvasId),
        isNull(chatMessage.archivedBy),
        lt(chatMessage.id, before),
      ),
    )
    .returning({ id: chatMessage.id });
  return rows.length;
}

/** Brings back the chat a reset hid; `by` limits it to one reset. */
export async function restoreMessages(
  db: Db,
  canvasId: string,
  by?: string,
): Promise<number> {
  const rows = await db
    .update(chatMessage)
    .set({ archivedBy: null })
    .where(
      and(
        eq(chatMessage.canvasId, canvasId),
        by ? eq(chatMessage.archivedBy, by) : isNotNull(chatMessage.archivedBy),
      ),
    )
    .returning({ id: chatMessage.id });
  return rows.length;
}

/** Session to resume: one per (agent, target card); the Assistant passes nulls. */
export async function lastSessionId(
  db: Db,
  canvasId: string,
  agentId: string | null,
  target: string | null,
  provider?: string,
  /** Ignore sessions older than this: the provider's prompt cache has expired and resuming rewrites it all. */
  maxAgeMs?: number,
): Promise<string | null> {
  const [row] = await db
    .select({ sessionId: attempt.sessionId, startedAt: attempt.startedAt })
    .from(chatMessage)
    .innerJoin(attempt, eq(chatMessage.attemptId, attempt.id))
    .where(
      and(
        eq(chatMessage.canvasId, canvasId),
        agentId
          ? eq(chatMessage.agentId, agentId)
          : isNull(chatMessage.agentId),
        target ? eq(chatMessage.target, target) : isNull(chatMessage.target),
        isNotNull(attempt.sessionId),
        provider ? like(attempt.model, `${provider}:%`) : undefined,
        // Sessions from before a reset remember a canvas that is gone.
        isNull(chatMessage.archivedBy),
      ),
    )
    .orderBy(desc(chatMessage.createdAt))
    .limit(1);

  if (
    row &&
    maxAgeMs !== undefined &&
    Date.now() - Date.parse(row.startedAt) > maxAgeMs
  ) {
    return null;
  }

  return row?.sessionId ?? null;
}

const sameRun = (agentId: string | null, target: string | null) =>
  and(
    agentId ? eq(chatMessage.agentId, agentId) : isNull(chatMessage.agentId),
    target ? eq(chatMessage.target, target) : isNull(chatMessage.target),
  );

const runKey = (m: ChatMessage) => `${m.agentId ?? ""}|${m.target ?? ""}`;

/**
 * Every chat exchange about a card, oldest first: runs that targeted it and runs that changed it.
 * Includes messages a reset archived, since the history is still worth searching.
 */
export async function listCardExchanges(
  db: Db,
  canvasId: string,
  cardId: string,
): Promise<CardExchange[]> {
  const rows = (await db
    .select()
    .from(chatMessage)
    .where(
      and(
        eq(chatMessage.canvasId, canvasId),
        or(
          eq(chatMessage.target, cardId),
          sql`exists (select 1 from json_each(${chatMessage.cards}) where value = ${cardId})`,
        ),
      ),
    )
    .orderBy(asc(chatMessage.createdAt))) as ChatMessage[];

  // A reply that changed the card while targeting another one: bring in the request that started it.
  const seen = new Set(rows.map((m) => m.id));
  for (const reply of rows.filter(
    (m) => m.role === "assistant" && m.target !== cardId,
  )) {
    const [request] = (await db
      .select()
      .from(chatMessage)
      .where(
        and(
          eq(chatMessage.canvasId, canvasId),
          eq(chatMessage.role, "user"),
          sameRun(reply.agentId, reply.target),
          lte(chatMessage.createdAt, reply.createdAt),
        ),
      )
      .orderBy(desc(chatMessage.createdAt))
      .limit(1)) as ChatMessage[];

    if (request && !seen.has(request.id)) {
      seen.add(request.id);
      rows.push(request);
    }
  }

  // Ids are not ordered within a millisecond; a request always comes before its reply.
  rows.sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) ||
      Number(a.role === "assistant") - Number(b.role === "assistant"),
  );

  // One run per (agent, target) at a time, so a reply answers the latest open request with that key.
  const open = new Map<string, CardExchange>();
  const exchanges: CardExchange[] = [];

  for (const message of rows) {
    const key = runKey(message);
    if (message.role === "user") {
      const exchange = { request: message, reply: null };
      open.set(key, exchange);
      exchanges.push(exchange);
      continue;
    }
    const exchange = open.get(key);
    if (exchange) {
      exchange.reply = message;
      open.delete(key);
    } else {
      exchanges.push({ request: null, reply: message });
    }
  }

  return exchanges;
}
