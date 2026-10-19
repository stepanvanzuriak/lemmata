import { useState } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import {
  cardStatus,
  type CanvasEdge,
  type CanvasGraph,
  type CanvasNode,
  type CardStatus,
} from "shared";
import { useCanvas } from "../../api/canvases";
import type { CardFlowNode } from "./cards/CardNode";
import { toFlowEdge, type CardFlowEdge } from "./edges";

const sameStatus = (a?: CardStatus | null, b?: CardStatus | null) =>
  a?.tone === b?.tone && a?.label === b?.label && a?.detail === b?.detail;

function toFlowNode(
  node: CanvasNode,
  graph: CanvasGraph,
  prev?: CardFlowNode,
): CardFlowNode {
  const status = cardStatus(node, graph);
  const unchanged =
    prev &&
    prev.data.node.updatedAt === node.updatedAt &&
    sameStatus(prev.data.status, status);

  return {
    id: node.id,
    type: "card",
    position: { x: node.x, y: node.y },
    data: unchanged ? prev.data : { node, status },
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

  const adopt = (graph: CanvasGraph) => {
    const prev = new Map(nodes.map((node) => [node.id, node]));
    const selectedEdges = new Set(
      edges.filter((edge) => edge.selected).map(({ id }) => id),
    );

    setNodes(
      graph.nodes.map((node) => toFlowNode(node, graph, prev.get(node.id))),
    );
    setEdges(
      graph.edges.map((edge) => ({
        ...toFlowEdge(edge),
        selected: selectedEdges.has(edge.id),
      })),
    );
  };

  if (query.data && query.dataUpdatedAt !== syncedAt) {
    setSyncedAt(query.dataUpdatedAt);
    adopt(query.data);
  }

  const onNodesChange: OnNodesChange<CardFlowNode> = (changes) =>
    setNodes((current) => applyNodeChanges(changes, current));

  const onEdgesChange: OnEdgesChange<CardFlowEdge> = (changes) =>
    setEdges((current) => applyEdgeChanges(changes, current));

  const mergeLive = (live: CanvasNode[], liveEdges: CanvasEdge[]) =>
    adopt({
      nodes: mergeById(
        nodes.map(({ data }) => data.node),
        live,
      ),
      edges: mergeById(
        edges.flatMap(({ data }) => (data ? [data.edge] : [])),
        liveEdges,
      ),
    });

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
