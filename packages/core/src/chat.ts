import { and, desc, eq, isNotNull, isNull, lt, like } from "drizzle-orm";
import type { Db } from "./db/index.js";
import { attempt, chatMessage, type ChatMessage } from "./db/schema.js";
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
