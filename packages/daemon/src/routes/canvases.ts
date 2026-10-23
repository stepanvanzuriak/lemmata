import { rm } from "node:fs/promises";
import { Hono } from "hono";
import { z } from "zod";
import {
  type Db,
  type CanvasNode as CanvasNodeRow,
  EDGE_KINDS,
  NODE_CREATORS,
  GoalNodeError,
  NotFoundError,
  addEdge,
  addNode,
  createCanvas,
  deleteEdge,
  deleteNode,
  getCanvas,
  listCanvases,
  parsePayload,
  restoreMessages,
  updateNode,
  updateNodePositions,
} from "core";
import type { CanvasDetail, CanvasNode, NodeKind, Toolchain } from "shared";
import { ArxivError, type ArxivClient } from "../arxiv/arxiv.js";
import { fetchPaperSource, addPaper } from "../cards/paper.js";
import { ToolRefusal, type RunContext } from "../cards/types.js";
import { validate } from "../validate.js";
import { figuresDir, RUNNABLE_KINDS, runCardNode } from "../runCard.js";

const NODE_KINDS = [
  "goal",
  "hypothesis",
  "statement",
  "note",
  "memory",
  "arxiv",
  "literature",
  "python",
  "lean",
] as const satisfies readonly NodeKind[];

const payload = z.record(z.string(), z.unknown());

const createCanvasSchema = z.object({ title: z.string().optional() });

const addNodeSchema = z.object({
  kind: z.enum(NODE_KINDS),
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number().optional(),
  h: z.number().optional(),
  payload: payload.optional(),
  createdBy: z.enum(NODE_CREATORS).optional(),
});

const positionsSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      x: z.number(),
      y: z.number(),
      w: z.number().optional(),
      h: z.number().optional(),
    }),
  ),
});

const restoreSchema = z.object({
  ids: z.array(z.string()).optional(),
  by: z.string().optional(),
});

const addPaperSchema = z.object({
  arxivId: z.string().min(1),
  connectFrom: z.string().optional(),
});

const addEdgeSchema = z.object({
  fromNode: z.string(),
  toNode: z.string(),
  kind: z.enum(EDGE_KINDS),
});

function toNode(row: CanvasNodeRow): CanvasNode {
  return {
    ...row,
    kind: row.kind as NodeKind,
    payload: parsePayload(row.payload) as CanvasNode["payload"],
  };
}

export function canvasRoutes(
  db: Db,
  {
    workspaceDir,
    toolchain,
    arxiv,
  }: {
    workspaceDir: string;
    toolchain: Promise<Toolchain>;
    arxiv: ArxivClient;
  },
) {
  const canvasExists = async (id: string) =>
    Boolean(await db.query.canvas.findFirst({ where: { id } }));

  const byUser = (canvasId: string): RunContext => ({
    canvasId,
    author: { role: "assistant" },
  });

  return new Hono()
    .get("/canvases", async (c) => {
      const projectId = c.req.query("projectId");

      if (!projectId) {
        return c.json({ error: "projectId is required" }, 400);
      }

      return c.json(await listCanvases(db, projectId), 200);
    })
    .get("/canvases/:id", async (c) => {
      const detail = await getCanvas(db, c.req.param("id"));

      if (!detail) {
        return c.json({ error: "canvas not found" }, 404);
      }

      return c.json<CanvasDetail>(
        { ...detail, nodes: detail.nodes.map(toNode) },
        200,
      );
    })
    .post(
      "/projects/:id/canvases",
      validate("json", createCanvasSchema),
      async (c) => {
        try {
          const canvas = await createCanvas(
            db,
            c.req.param("id"),
            c.req.valid("json").title,
          );

          return c.json(canvas, 201);
        } catch (error) {
          if (error instanceof NotFoundError) {
            return c.json({ error: "project not found" }, 404);
          }
          throw error;
        }
      },
    )
    .post("/canvases/:id/nodes", validate("json", addNodeSchema), async (c) => {
      const canvasId = c.req.param("id");

      if (!(await canvasExists(canvasId))) {
        return c.json({ error: "canvas not found" }, 404);
      }

      const node = await addNode(db, { ...c.req.valid("json"), canvasId });

      return c.json(toNode(node), 201);
    })
    .post(
      "/canvases/:id/papers",
      validate("json", addPaperSchema),
      async (c) => {
        const canvasId = c.req.param("id");

        if (!(await canvasExists(canvasId))) {
          return c.json({ error: "canvas not found" }, 404);
        }

        const { arxivId, connectFrom } = c.req.valid("json");

        try {
          const node = await addPaper(db, arxiv, byUser(canvasId), {
            id: arxivId,
            connectFrom,
            by: "user",
          });

          return c.json(node, 201);
        } catch (error) {
          if (error instanceof ToolRefusal || error instanceof ArxivError) {
            return c.json({ error: error.message }, 400);
          }
          throw error;
        }
      },
    )
    .patch(
      "/canvases/:id/nodes",
      validate("json", positionsSchema),
      async (c) => {
        const canvasId = c.req.param("id");

        if (!(await canvasExists(canvasId))) {
          return c.json({ error: "canvas not found" }, 404);
        }

        await updateNodePositions(db, canvasId, c.req.valid("json").nodes);

        return c.json({ ok: true }, 200);
      },
    )
    .post(
      "/canvases/:id/restore",
      validate("json", restoreSchema),
      async (c) => {
        const detail = await getCanvas(db, c.req.param("id"));

        if (!detail) {
          return c.json({ error: "canvas not found" }, 404);
        }

        const { ids, by } = c.req.valid("json");
        const wanted = ids && new Set(ids);
        const restored: CanvasNode[] = [];

        for (const row of detail.nodes) {
          const archived = parsePayload(row.payload).archived as
            { by?: string } | null | undefined;

          if (
            !archived ||
            (wanted && !wanted.has(row.id)) ||
            (by && archived.by !== by)
          ) {
            continue;
          }

          const node = await updateNode(db, row.id, { archived: null });
          restored.push(toNode(node!));
        }

        // Undoing a reset brings back the chat it hid too.
        const messages = ids
          ? 0
          : await restoreMessages(db, detail.canvas.id, by);

        return c.json({ restored, messages }, 200);
      },
    )
    .patch("/nodes/:id", validate("json", payload), async (c) => {
      const node = await updateNode(db, c.req.param("id"), c.req.valid("json"));

      if (!node) {
        return c.json({ error: "node not found" }, 404);
      }

      return c.json(toNode(node), 200);
    })
    .post("/nodes/:id/run", async (c) => {
      const node = await db.query.canvasNode.findFirst({
        where: { id: c.req.param("id") },
      });

      if (!node) {
        return c.json({ error: "node not found" }, 404);
      }
      if (!RUNNABLE_KINDS.has(node.kind)) {
        return c.json({ error: `${node.kind} cards cannot be run` }, 400);
      }

      const updated = await runCardNode(db, node, {
        workspaceDir,
        toolchain,
        isolated: false,
      });

      return c.json(toNode(updated!), 200);
    })
    .post("/nodes/:id/source", async (c) => {
      const node = await db.query.canvasNode.findFirst({
        where: { id: c.req.param("id") },
      });

      if (!node) {
        return c.json({ error: "node not found" }, 404);
      }
      if (node.kind !== "arxiv") {
        return c.json({ error: `${node.kind} cards have no source` }, 400);
      }

      try {
        const { card } = await fetchPaperSource(
          db,
          arxiv,
          workspaceDir,
          byUser(node.canvasId),
          node.id,
          { refresh: true },
        );

        return c.json(card, 200);
      } catch (error) {
        if (error instanceof ToolRefusal || error instanceof ArxivError) {
          return c.json({ error: error.message }, 502);
        }
        throw error;
      }
    })
    .delete("/nodes/:id", async (c) => {
      try {
        const node = await deleteNode(db, c.req.param("id"));

        if (!node) {
          return c.json({ error: "node not found" }, 404);
        }

        await rm(figuresDir(workspaceDir, node.id), {
          recursive: true,
          force: true,
        });

        return c.json(toNode(node), 200);
      } catch (error) {
        if (error instanceof GoalNodeError) {
          return c.json({ error: "the goal node cannot be deleted" }, 409);
        }
        throw error;
      }
    })
    .post("/canvases/:id/edges", validate("json", addEdgeSchema), async (c) => {
      const canvasId = c.req.param("id");
      const detail = await getCanvas(db, canvasId);

      if (!detail) {
        return c.json({ error: "canvas not found" }, 404);
      }

      const { fromNode, toNode: to } = c.req.valid("json");
      const ids = new Set(detail.nodes.map((n) => n.id));

      if (!ids.has(fromNode) || !ids.has(to)) {
        return c.json({ error: "node not found" }, 404);
      }

      const edge = await addEdge(db, { ...c.req.valid("json"), canvasId });

      return c.json(edge, 201);
    })
    .delete("/edges/:id", async (c) => {
      const edge = await deleteEdge(db, c.req.param("id"));

      if (!edge) {
        return c.json({ error: "edge not found" }, 404);
      }

      return c.json(edge, 200);
    });
}
