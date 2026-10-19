import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
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
  },
): Promise<ChatMessage> {
  const [row] = await db
    .insert(chatMessage)
    .values({ ...input, createdAt: isoNow() })
    .returning();
  return row!;
}

export function listMessages(db: Db, canvasId: string): Promise<ChatMessage[]> {
  return db.query.chatMessage.findMany({
    where: { canvasId },
    orderBy: { createdAt: "asc" },
  });
}

/** Session to resume: one per (agent, target card); the Assistant passes nulls. */
export async function lastSessionId(
  db: Db,
  canvasId: string,
  agentId: string | null,
  target: string | null,
): Promise<string | null> {
  const [row] = await db
    .select({ sessionId: attempt.sessionId })
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
      ),
    )
    .orderBy(desc(chatMessage.createdAt))
    .limit(1);

  return row?.sessionId ?? null;
}
