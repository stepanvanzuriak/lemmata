import { defineRelations } from "drizzle-orm";
import * as schema from "./schema.js";

export const relations = defineRelations(schema, (r) => ({
  project: {
    canvases: r.many.canvas(),
  },
  canvas: {
    project: r.one.project({
      from: r.canvas.projectId,
      to: r.project.id,
    }),
    nodes: r.many.canvasNode(),
    edges: r.many.canvasEdge(),
  },
  canvasNode: {
    canvas: r.one.canvas({
      from: r.canvasNode.canvasId,
      to: r.canvas.id,
    }),
  },
  canvasEdge: {
    canvas: r.one.canvas({
      from: r.canvasEdge.canvasId,
      to: r.canvas.id,
    }),
    source: r.one.canvasNode({
      from: r.canvasEdge.fromNode,
      to: r.canvasNode.id,
    }),
    target: r.one.canvasNode({
      from: r.canvasEdge.toNode,
      to: r.canvasNode.id,
    }),
  },
}));
