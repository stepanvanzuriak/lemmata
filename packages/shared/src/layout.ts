import type { ElkNode, LayoutOptions } from "elkjs/lib/elk-api.js";
import type { CanvasNode } from "./canvas.js";
import type { NodeKind } from "./cards.js";

export type LayoutNode = { id: string; width: number; height: number };
export type LayoutEdge = { from: string; to: string };
export type Positions = Map<string, { x: number; y: number }>;

export const NODE_GAP = 40;
export const LAYER_GAP = 120;

const WIDTH: Record<NodeKind, number> = {
  goal: 320,
  hypothesis: 340,
  attack: 340,
  statement: 300,
  note: 250,
  memory: 320,
  arxiv: 290,
  literature: 320,
  python: 290,
  lean: 290,
  toolbox: 300,
};
const HEIGHT: Partial<Record<NodeKind, number>> = {
  python: 200,
  lean: 200,
  literature: 200,
  toolbox: 300,
};

/** Use saved measurements when available; otherwise estimate by card kind. */
export function cardSize(
  node: Pick<CanvasNode, "kind"> & Partial<Pick<CanvasNode, "w" | "h">>,
) {
  return {
    width: node.w && node.w > 0 ? node.w : WIDTH[node.kind],
    height: node.h && node.h > 0 ? node.h : (HEIGHT[node.kind] ?? 150),
  };
}

/**
 * ELK's layered algorithm (the one React Flow's docs recommend for directed graphs):
 * left to right by dependency, real card sizes, fewer crossings, creation order kept
 * where it costs nothing so repeated layouts stay stable.
 */
const OPTIONS: LayoutOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.spacing.nodeNode": String(NODE_GAP),
  "elk.layered.spacing.nodeNodeBetweenLayers": String(LAYER_GAP),
  "elk.spacing.componentComponent": "80",
  "elk.layered.cycleBreaking.strategy": "GREEDY",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
};

type Elk = { layout: (graph: ElkNode) => Promise<ElkNode> };

let elk: Promise<Elk> | null = null;

/** ELK is ~1.4 MB; it loads the first time someone lays out a canvas. */
function loadElk() {
  elk ??= import("elkjs/lib/elk.bundled.js").then(({ default: ELK }) => {
    // ELK's CommonJS export is a constructor in both Node and the browser bundle.
    const Constructor = ELK as unknown as new () => Elk;
    return new Constructor();
  });
  return elk;
}

/** Top-left positions for every node; edges to unknown nodes and self-loops are ignored. */
export async function tidyLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): Promise<Positions> {
  const known = new Set(nodes.map(({ id }) => id));
  const graph: ElkNode = {
    id: "root",
    layoutOptions: OPTIONS,
    children: nodes.map(({ id, width, height }) => ({ id, width, height })),
    edges: edges
      .filter(({ from, to }) => from !== to && known.has(from) && known.has(to))
      .map(({ from, to }, index) => ({
        id: `e${index}`,
        sources: [from],
        targets: [to],
      })),
  };

  const result = await (await loadElk()).layout(graph);

  return new Map(
    (result.children ?? []).map(({ id, x = 0, y = 0 }) => [id, { x, y }]),
  );
}
