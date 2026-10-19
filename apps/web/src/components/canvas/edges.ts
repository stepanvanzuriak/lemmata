import type { Edge } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { CanvasEdge, EdgeKind } from "shared";

export type CardFlowEdge = Edge<{ kind: EdgeKind }>;

export const EDGE_KINDS = [
  "depends-on",
  "checked-by",
  "refuted-by",
  "tested-by",
  "used-by",
] as const satisfies readonly EdgeKind[];

export const EDGE_LABELS: Record<EdgeKind, string> = {
  "depends-on": "depends on",
  "checked-by": "checked by",
  "refuted-by": "refuted by",
  "tested-by": "tested by",
  "used-by": "used by",
};

const EDGE_STYLES: Record<EdgeKind, CSSProperties> = {
  "depends-on": { stroke: "var(--color-lm-edge-depends)" },
  "checked-by": { stroke: "var(--color-lm-edge-checked)" },
  "refuted-by": {
    stroke: "var(--color-lm-edge-refuted)",
    strokeDasharray: "5 5",
  },
  "tested-by": { stroke: "var(--color-lm-edge-tested)" },
  "used-by": {
    stroke: "var(--color-lm-edge-used)",
    strokeWidth: 1.4,
    strokeDasharray: "2 4",
  },
};

export function toFlowEdge(edge: CanvasEdge): CardFlowEdge {
  return {
    id: edge.id,
    source: edge.fromNode,
    target: edge.toNode,
    type: "kind",
    style: { strokeWidth: 1.6, ...EDGE_STYLES[edge.kind] },
    data: { kind: edge.kind },
  };
}
