import { defineRelations } from "drizzle-orm";
import * as schema from "./schema.js";

export const relations = defineRelations(schema, (r) => ({
  project: {
    canvases: r.many.canvas(),
    attempts: r.many.attempt(),
    memory: r.many.memoryEntry(),
  },
  attempt: {
    project: r.one.project({
      from: r.attempt.projectId,
      to: r.project.id,
    }),
    canvas: r.one.canvas({
      from: r.attempt.canvasId,
      to: r.canvas.id,
    }),
  },
  canvas: {
    project: r.one.project({
      from: r.canvas.projectId,
      to: r.project.id,
    }),
    nodes: r.many.canvasNode(),
    edges: r.many.canvasEdge(),
    agents: r.many.canvasAgent(),
    messages: r.many.chatMessage(),
  },
  canvasAgent: {
    canvas: r.one.canvas({
      from: r.canvasAgent.canvasId,
      to: r.canvas.id,
    }),
  },
  chatMessage: {
    canvas: r.one.canvas({
      from: r.chatMessage.canvasId,
      to: r.canvas.id,
    }),
    attempt: r.one.attempt({
      from: r.chatMessage.attemptId,
      to: r.attempt.id,
    }),
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
  memoryEntry: {
    project: r.one.project({
      from: r.memoryEntry.projectId,
      to: r.project.id,
    }),
  },
}));
