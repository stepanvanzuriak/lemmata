import { and, eq } from "drizzle-orm";
import type { Db } from "./db/index.js";
import {
  canvas,
  canvasEdge,
  canvasNode,
  project,
  type Canvas,
  type CanvasEdge,
  type CanvasNode,
  type CreateCanvasEdgeInput,
  type CreateCanvasNodeInput,
} from "./db/schema.js";
import { isoNow } from "./ids.js";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Executor = Db | Tx;

export type NodePayload = Record<string, unknown>;

export type CanvasDetail = {
  canvas: Canvas;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

export type NodeInput = Omit<CreateCanvasNodeInput, "payload"> & {
  payload?: NodePayload;
};

export type NodePosition = {
  id: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
};

export class GoalNodeError extends Error {
  constructor(public readonly nodeId: string) {
    super(`The goal node ${nodeId} cannot be deleted`);
    this.name = "GoalNodeError";
  }
}

export class NotFoundError extends Error {
  constructor(what: string, id: string) {
    super(`${what} ${id} not found`);
    this.name = "NotFoundError";
  }
}

function touchCanvas(db: Executor, id: string, now: string) {
  return db.update(canvas).set({ updatedAt: now }).where(eq(canvas.id, id));
}

export function parsePayload(raw: string): NodePayload {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as NodePayload)
      : {};
  } catch {
    return {};
  }
}

export function listCanvases(db: Db, projectId: string): Promise<Canvas[]> {
  return db.query.canvas.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getCanvas(
  db: Db,
  id: string,
): Promise<CanvasDetail | null> {
  const row = await db.query.canvas.findFirst({
    where: { id },
    with: {
      nodes: { orderBy: { createdAt: "asc" } },
      edges: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!row) {
    return null;
  }

  const { nodes, edges, ...rest } = row;
  return { canvas: rest, nodes, edges };
}

export async function insertCanvasWithGoal(
  tx: Executor,
  projectId: string,
  title = "",
): Promise<Canvas> {
  const [owner] = await tx
    .select()
    .from(project)
    .where(eq(project.id, projectId));

  if (!owner) {
    throw new NotFoundError("project", projectId);
  }

  const now = isoNow();
  const [row] = await tx
    .insert(canvas)
    .values({ projectId, title, createdAt: now, updatedAt: now })
    .returning();

  await tx.insert(canvasNode).values({
    canvasId: row!.id,
    kind: "goal",
    payload: JSON.stringify({
      title: owner.title,
      text: owner.statement,
      status: "open",
    }),
    createdAt: now,
    updatedAt: now,
  });

  return row!;
}

export function createCanvas(
  db: Db,
  projectId: string,
  title?: string,
): Promise<Canvas> {
  return db.transaction((tx) => insertCanvasWithGoal(tx, projectId, title));
}

export async function addNode(db: Db, input: NodeInput): Promise<CanvasNode> {
  const now = isoNow();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(canvasNode)
      .values({
        canvasId: input.canvasId,
        kind: input.kind,
        x: input.x,
        y: input.y,
        w: input.w,
        h: input.h,
        payload: JSON.stringify(input.payload ?? {}),
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await touchCanvas(tx, input.canvasId, now);
    return row!;
  });
}

export async function updateNode(
  db: Db,
  id: string,
  patch: NodePayload,
): Promise<CanvasNode | undefined> {
  const now = isoNow();
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(canvasNode)
      .where(eq(canvasNode.id, id));

    if (!current) {
      return undefined;
    }

    const previous = parsePayload(current.payload);
    const payload = { ...previous, ...patch };

    if ("source" in patch && patch.source !== previous.source) {
      delete payload.run;
    }

    const [row] = await tx
      .update(canvasNode)
      .set({
        payload: JSON.stringify(payload),
        updatedAt: now,
      })
      .where(eq(canvasNode.id, id))
      .returning();

    await touchCanvas(tx, current.canvasId, now);
    return row;
  });
}

export function updateNodePositions(
  db: Db,
  canvasId: string,
  positions: NodePosition[],
): Promise<void> {
  const now = isoNow();
  return db.transaction(async (tx) => {
    for (const { id, x, y, w, h } of positions) {
      await tx
        .update(canvasNode)
        .set({ x, y, w, h })
        .where(and(eq(canvasNode.id, id), eq(canvasNode.canvasId, canvasId)));
    }
    await touchCanvas(tx, canvasId, now);
  });
}

export async function deleteNode(
  db: Db,
  id: string,
): Promise<CanvasNode | undefined> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(canvasNode)
      .where(eq(canvasNode.id, id));
    if (!current) {
      return undefined;
    }
    if (current.kind === "goal") {
      throw new GoalNodeError(id);
    }

    await tx.delete(canvasNode).where(eq(canvasNode.id, id));
    await touchCanvas(tx, current.canvasId, isoNow());
    return current;
  });
}

export async function addEdge(
  db: Db,
  input: CreateCanvasEdgeInput,
): Promise<CanvasEdge> {
  const now = isoNow();
  return db.transaction(async (tx) => {
    await tx
      .insert(canvasEdge)
      .values({
        canvasId: input.canvasId,
        fromNode: input.fromNode,
        toNode: input.toNode,
        kind: input.kind,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    const [row] = await tx
      .select()
      .from(canvasEdge)
      .where(
        and(
          eq(canvasEdge.fromNode, input.fromNode),
          eq(canvasEdge.toNode, input.toNode),
          eq(canvasEdge.kind, input.kind),
        ),
      );

    await touchCanvas(tx, input.canvasId, now);
    return row!;
  });
}

export async function deleteEdge(
  db: Db,
  id: string,
): Promise<CanvasEdge | undefined> {
  const [row] = await db
    .delete(canvasEdge)
    .where(eq(canvasEdge.id, id))
    .returning();

  if (row) {
    await touchCanvas(db, row.canvasId, isoNow());
  }
  return row;
}
