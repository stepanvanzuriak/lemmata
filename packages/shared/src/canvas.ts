import type {
  Canvas,
  CanvasEdge as CanvasEdgeRow,
  CanvasNode as CanvasNodeRow,
} from "core/schema";
import type { NodeKind, NodePayload } from "./cards.js";

export type { Canvas };

export type EdgeKind = CanvasEdgeRow["kind"];

export type CanvasEdge = CanvasEdgeRow;

export type CanvasNode = Omit<CanvasNodeRow, "kind" | "payload"> & {
  kind: NodeKind;
  payload: NodePayload;
};

export type CanvasDetail = {
  canvas: Canvas;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

export type CreateCanvasRequest = { title?: string };

export type AddNodeRequest = {
  kind: NodeKind;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  payload?: Partial<NodePayload>;
  createdBy?: CanvasNode["createdBy"];
};

export type UpdateNodeRequest = NodePayload extends infer P
  ? P extends NodePayload
    ? Partial<Omit<P, "kind">>
    : never
  : never;

export type NodePositionInput = {
  id: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
};

export type UpdateNodePositionsRequest = { nodes: NodePositionInput[] };

export type AddEdgeRequest = {
  fromNode: string;
  toNode: string;
  kind: EdgeKind;
};
