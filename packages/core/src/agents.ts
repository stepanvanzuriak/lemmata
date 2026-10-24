import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./db/index.js";
import {
  canvasAgent,
  canvasNode,
  type AgentRole,
  type CanvasAgent,
} from "./db/schema.js";

export function listAgents(db: Db, canvasId: string): Promise<CanvasAgent[]> {
  return db.query.canvasAgent.findMany({
    where: { canvasId },
    orderBy: { createdAt: "asc" },
  });
}

export function getAgent(db: Db, id: string): Promise<CanvasAgent | undefined> {
  return db.query.canvasAgent.findFirst({ where: { id } });
}

/** Throws on a second agent with the same role on a canvas (unique index). */
export async function addAgent(
  db: Db,
  input: {
    canvasId: string;
    role: AgentRole;
    model?: string | null;
    tokenCap?: number | null;
  },
): Promise<CanvasAgent> {
  const [row] = await db.insert(canvasAgent).values(input).returning();
  return row!;
}

export async function updateAgent(
  db: Db,
  id: string,
  patch: { model?: string | null; tokenCap?: number | null },
): Promise<CanvasAgent | undefined> {
  const [row] = await db
    .update(canvasAgent)
    .set(patch)
    .where(eq(canvasAgent.id, id))
    .returning();
  return row;
}

export async function removeAgent(
  db: Db,
  canvasId: string,
  id: string,
): Promise<CanvasAgent | undefined> {
  const [row] = await db
    .delete(canvasAgent)
    .where(and(eq(canvasAgent.id, id), eq(canvasAgent.canvasId, canvasId)))
    .returning();
  return row;
}

/** Releases every claim and stale run marker; run at daemon start so a crash can't lock hypotheses forever. */
export async function clearClaims(db: Db): Promise<number> {
  const rows = await db
    .update(canvasNode)
    .set({
      payload: sql`json_remove(
        CASE WHEN json_extract(${canvasNode.payload}, '$.status') = 'claimed'
          THEN json_set(${canvasNode.payload}, '$.status', 'open')
          ELSE ${canvasNode.payload} END,
        '$.claimedBy', '$.claimedByRole')`,
    })
    .where(sql`json_extract(${canvasNode.payload}, '$.claimedBy') IS NOT NULL`)
    .returning({ id: canvasNode.id });

  await db
    .update(canvasNode)
    .set({
      payload: sql`json_remove(${canvasNode.payload}, '$.runningSince')`,
    })
    .where(
      sql`json_extract(${canvasNode.payload}, '$.runningSince') IS NOT NULL`,
    );

  return rows.length;
}
