import { useState } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import {
  cardStatus,
  settleReady,
  type CanvasEdge,
  type CanvasGraph,
  type CanvasNode,
  type CardStatus,
} from "shared";
import { useCanvas } from "../../api/canvases";
import type { CardFlowNode } from "./cards/CardNode";
import { toFlowEdge, type CardFlowEdge } from "./edges";

const sameStatus = (a?: CardStatus | null, b?: CardStatus | null) =>
  a?.tone === b?.tone &&
  a?.label === b?.label &&
  a?.detail === b?.detail &&
  a?.since === b?.since;

function toFlowNode(
  node: CanvasNode,
  graph: CanvasGraph,
  prev?: CardFlowNode,
): CardFlowNode {
  const status = cardStatus(node, graph);
  const ready = settleReady(node, graph);
  const unchanged =
    prev &&
    prev.data.node.updatedAt === node.updatedAt &&
    prev.data.ready === ready &&
    sameStatus(prev.data.status, status);

  const serverMoved =
    !prev || prev.data.node.x !== node.x || prev.data.node.y !== node.y;

  return {
    id: node.id,
    type: "card",
    position: serverMoved ? { x: node.x, y: node.y } : prev.position,
    data: unchanged ? prev.data : { node, status, ready },
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

type Live = { nodes: CanvasNode[]; edges: CanvasEdge[]; version: number };

const NO_LIVE: Live = { nodes: [], edges: [], version: 0 };

export function useCanvasData(id: string) {
  const query = useCanvas(id);
  const [nodes, setNodes] = useState<CardFlowNode[]>([]);
  const [edges, setEdges] = useState<CardFlowEdge[]>([]);
  const [syncedAt, setSyncedAt] = useState(0);
  const [live, setLive] = useState<Live>(NO_LIVE);
  const [liveVersion, setLiveVersion] = useState(0);

  const adopt = (graph: CanvasGraph, fresh = new Set<string>()) => {
    const prev = new Map(nodes.map((node) => [node.id, node]));
    const selectedEdges = new Set(
      edges.filter((edge) => edge.selected).map(({ id }) => id),
    );

    setNodes(
      graph.nodes.map((node) => {
        const flowNode = toFlowNode(node, graph, prev.get(node.id));
        const className = fresh.has(node.id)
          ? "lm-new"
          : prev.get(node.id)?.className;

        return className ? { ...flowNode, className } : flowNode;
      }),
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
    setLive(NO_LIVE);
    setLiveVersion(0);
    adopt(query.data);
  } else if (live.version !== liveVersion) {
    const known = new Set(nodes.map((node) => node.id));

    setLiveVersion(live.version);
    adopt(
      {
        nodes: mergeById(
          nodes.map(({ data }) => data.node),
          live.nodes,
        ),
        edges: mergeById(
          edges.flatMap(({ data }) => (data ? [data.edge] : [])),
          live.edges,
        ),
      },
      new Set(
        live.nodes.map((n) => n.id).filter((nodeId) => !known.has(nodeId)),
      ),
    );
  }

  const onNodesChange: OnNodesChange<CardFlowNode> = (changes) =>
    setNodes((current) => applyNodeChanges(changes, current));

  const onEdgesChange: OnEdgesChange<CardFlowEdge> = (changes) =>
    setEdges((current) => applyEdgeChanges(changes, current));

  const mergeLive = (liveNodes: CanvasNode[], liveEdges: CanvasEdge[]) =>
    setLive((current) => ({
      nodes: mergeById(current.nodes, liveNodes),
      edges: mergeById(current.edges, liveEdges),
      version: current.version + 1,
    }));

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
