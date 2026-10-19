import { eq, sql } from "drizzle-orm";
import type { Db } from "./db/index.js";
import { attempt, type Attempt, type AttemptStatus } from "./db/schema.js";
import { isoNow } from "./ids.js";

export type AttemptUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

export async function startAttempt(
  db: Db,
  input: {
    projectId: string;
    canvasId?: string | null;
    title: string;
    model?: string | null;
  },
): Promise<Attempt> {
  const [row] = await db
    .insert(attempt)
    .values({
      projectId: input.projectId,
      canvasId: input.canvasId ?? null,
      title: input.title,
      model: input.model ?? null,
      startedAt: isoNow(),
    })
    .returning();

  return row!;
}

export async function addAttemptUsage(
  db: Db,
  id: string,
  usage: AttemptUsage,
): Promise<void> {
  await db
    .update(attempt)
    .set({
      inputTokens: sql`${attempt.inputTokens} + ${usage.input}`,
      outputTokens: sql`${attempt.outputTokens} + ${usage.output}`,
      cacheReadTokens: sql`${attempt.cacheReadTokens} + ${usage.cacheRead}`,
      cacheWriteTokens: sql`${attempt.cacheWriteTokens} + ${usage.cacheWrite}`,
    })
    .where(eq(attempt.id, id));
}

export async function setAttemptSession(
  db: Db,
  id: string,
  sessionId: string,
): Promise<void> {
  await db.update(attempt).set({ sessionId }).where(eq(attempt.id, id));
}

export async function finishAttempt(
  db: Db,
  id: string,
  status: Exclude<AttemptStatus, "running">,
): Promise<Attempt> {
  const [row] = await db
    .update(attempt)
    .set({ status, finishedAt: isoNow() })
    .where(eq(attempt.id, id))
    .returning();

  return row!;
}

export function listAttempts(
  db: Db,
  filter: { projectId?: string; canvasId?: string } = {},
): Promise<Attempt[]> {
  return db.query.attempt.findMany({
    where: {
      ...(filter.projectId && { projectId: filter.projectId }),
      ...(filter.canvasId && { canvasId: filter.canvasId }),
    },
    orderBy: { startedAt: "desc" },
  });
}

export const attemptTokens = (row: Attempt) =>
  row.inputTokens +
  row.outputTokens +
  row.cacheReadTokens +
  row.cacheWriteTokens;
