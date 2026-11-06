import { and, eq, inArray } from "drizzle-orm";
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

export class UniqueToolboxError extends Error {
  constructor(public readonly canvasId: string) {
    super("This canvas already has a toolbox card");
    this.name = "UniqueToolboxError";
  }
}

export class BranchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BranchError";
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
    if (input.kind === "toolbox") {
      const existing = await tx
        .select({ id: canvasNode.id })
        .from(canvasNode)
        .where(
          and(
            eq(canvasNode.canvasId, input.canvasId),
            eq(canvasNode.kind, "toolbox"),
          ),
        )
        .limit(1);
      if (existing.length) {
        throw new UniqueToolboxError(input.canvasId);
      }
    }
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

export function setNodeCollapsed(
  db: Db,
  id: string,
  collapsed: boolean,
): Promise<CanvasNode | undefined> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(canvasNode)
      .set({ collapsed })
      .where(eq(canvasNode.id, id))
      .returning();
    if (row) {
      await touchCanvas(tx, row.canvasId, isoNow());
    }
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

/**
 * Split a card and everything below it (following edges from source to target)
 * into a new canvas linked back to this one. The cards and the edges between
 * them move, and a link card takes the card's place here; edges into or out of the card itself move to the link, other edges that crossed the split are dropped, and the toolbox is
 * copied so both canvases keep theirs. The moved card becomes the new
 * canvas's goal.
 */
export function branchCanvas(
  db: Db,
  nodeId: string,
): Promise<{ canvas: Canvas; moved: string[]; link: string }> {
  return db.transaction(async (tx) => {
    const [root] = await tx
      .select()
      .from(canvasNode)
      .where(eq(canvasNode.id, nodeId));

    if (!root) {
      throw new NotFoundError("node", nodeId);
    }
    if (root.kind === "goal" || root.kind === "toolbox") {
      throw new BranchError(`A ${root.kind} card cannot start a new canvas`);
    }

    const source = await tx.query.canvas.findFirst({
      where: { id: root.canvasId },
      with: { nodes: true, edges: true },
    });
    const kinds = new Map(source!.nodes.map((n) => [n.id, n.kind]));
    const children = new Map<string, string[]>();
    for (const { fromNode, toNode } of source!.edges) {
      children.set(fromNode, [...(children.get(fromNode) ?? []), toNode]);
    }

    const moved = new Set<string>();
    const pending = [root.id];
    while (pending.length) {
      const id = pending.pop()!;
      const kind = kinds.get(id);
      if (moved.has(id) || kind === "goal" || kind === "toolbox") {
        continue;
      }
      moved.add(id);
      pending.push(...(children.get(id) ?? []));
    }

    const toolbox = source!.nodes.find((n) => n.kind === "toolbox");
    const now = isoNow();
    const title = String(parsePayload(root.payload).title ?? "").trim();

    const [created] = await tx
      .insert(canvas)
      .values({
        projectId: source!.projectId,
        title: title || source!.title,
        parentCanvasId: source!.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const canvasId = created!.id;

    let newToolboxId: string | undefined;
    if (toolbox) {
      [{ id: newToolboxId }] = (await tx
        .insert(canvasNode)
        .values({
          canvasId,
          kind: "toolbox",
          x: toolbox.x,
          y: toolbox.y,
          w: toolbox.w,
          h: toolbox.h,
          collapsed: toolbox.collapsed,
          payload: toolbox.payload,
          createdBy: toolbox.createdBy,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: canvasNode.id })) as [{ id: string }];
    }

    const [link] = await tx
      .insert(canvasNode)
      .values({
        canvasId: source!.id,
        kind: "canvas",
        x: root.x,
        y: root.y,
        payload: JSON.stringify({
          title: title || created!.title,
          canvasId,
        }),
        createdBy: "user",
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: canvasNode.id });

    const ids = [...moved];
    await tx
      .update(canvasNode)
      .set({ canvasId })
      .where(inArray(canvasNode.id, ids));

    for (const edge of source!.edges) {
      const from = moved.has(edge.fromNode);
      const to = moved.has(edge.toNode);
      if (from && to) {
        await tx
          .update(canvasEdge)
          .set({ canvasId })
          .where(eq(canvasEdge.id, edge.id));
      } else if (
        to &&
        edge.toNode === root.id &&
        edge.fromNode !== toolbox?.id
      ) {
        // Whatever led to the card now leads to its link.
        await tx
          .update(canvasEdge)
          .set({ toNode: link!.id })
          .where(eq(canvasEdge.id, edge.id));
      } else if (
        from &&
        edge.fromNode === root.id &&
        edge.toNode !== toolbox?.id
      ) {
        // Whatever the card led to is now led to by its link.
        await tx
          .update(canvasEdge)
          .set({ fromNode: link!.id })
          .where(eq(canvasEdge.id, edge.id));
      } else if ((from || to) && toolbox && newToolboxId) {
        const other = from ? edge.toNode : edge.fromNode;
        if (other === toolbox.id) {
          await tx
            .update(canvasEdge)
            .set({
              canvasId,
              ...(from ? { toNode: newToolboxId } : { fromNode: newToolboxId }),
            })
            .where(eq(canvasEdge.id, edge.id));
          continue;
        }
        await tx.delete(canvasEdge).where(eq(canvasEdge.id, edge.id));
      } else if (from || to) {
        await tx.delete(canvasEdge).where(eq(canvasEdge.id, edge.id));
      }
    }

    // The moved card becomes the goal of the new canvas.
    const { label: _label, ...rootPayload } = parsePayload(root.payload);
    const status = ["proved", "disproved"].includes(String(rootPayload.status))
      ? rootPayload.status
      : "open";
    await tx
      .update(canvasNode)
      .set({
        kind: "goal",
        payload: JSON.stringify({ ...rootPayload, status }),
        updatedAt: now,
      })
      .where(eq(canvasNode.id, root.id));

    await touchCanvas(tx, source!.id, now);
    return { canvas: created!, moved: ids, link: link!.id };
  });
}
