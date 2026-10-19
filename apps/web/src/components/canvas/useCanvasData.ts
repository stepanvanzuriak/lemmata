import { useState } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import type { CanvasEdge, CanvasNode } from "shared";
import { useCanvas } from "../../api/canvases";
import type { CardFlowNode } from "./cards/CardNode";
import { toFlowEdge, type CardFlowEdge } from "./edges";

function toFlowNode(node: CanvasNode, prev?: CardFlowNode): CardFlowNode {
  return {
    id: node.id,
    type: "card",
    position: { x: node.x, y: node.y },
    data:
      prev && prev.data.node.updatedAt === node.updatedAt
        ? prev.data
        : { node },
    selected: prev?.selected,
    deletable: node.kind !== "goal",
  };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const byId = new Map(incoming.map((item) => [item.id, item]));
  const merged = current.map((item) => byId.get(item.id) ?? item);
  const known = new Set(current.map(({ id }) => id));

  return [...merged, ...incoming.filter(({ id }) => !known.has(id))];
}

export function useCanvasData(id: string) {
  const query = useCanvas(id);
  const [nodes, setNodes] = useState<CardFlowNode[]>([]);
  const [edges, setEdges] = useState<CardFlowEdge[]>([]);
  const [syncedAt, setSyncedAt] = useState(0);

  if (query.data && query.dataUpdatedAt !== syncedAt) {
    const prev = new Map(nodes.map((node) => [node.id, node]));
    const selectedEdges = new Set(
      edges.filter((edge) => edge.selected).map(({ id }) => id),
    );

    setSyncedAt(query.dataUpdatedAt);
    setNodes(
      query.data.nodes.map((node) => toFlowNode(node, prev.get(node.id))),
    );
    setEdges(
      query.data.edges.map((edge) => ({
        ...toFlowEdge(edge),
        selected: selectedEdges.has(edge.id),
      })),
    );
  }

  const onNodesChange: OnNodesChange<CardFlowNode> = (changes) =>
    setNodes((current) => applyNodeChanges(changes, current));

  const onEdgesChange: OnEdgesChange<CardFlowEdge> = (changes) =>
    setEdges((current) => applyEdgeChanges(changes, current));

  const mergeLive = (live: CanvasNode[], liveEdges: CanvasEdge[]) => {
    setNodes((current) => {
      const prev = new Map(current.map((node) => [node.id, node]));
      return mergeById(
        current,
        live.map((node) => toFlowNode(node, prev.get(node.id))),
      );
    });
    setEdges((current) => mergeById(current, liveEdges.map(toFlowEdge)));
  };

  return {
    query,
    detail: query.data,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    mergeLive,
  };
}
