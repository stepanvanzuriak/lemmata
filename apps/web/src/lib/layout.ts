export type LayoutNode = { id: string; width: number; height: number };
export type LayoutEdge = { from: string; to: string };

const COLUMN_GAP = 120;
const ROW_GAP = 48;

/** Longest path from a source, so every edge points to a later column. Cycles are cut by the pass limit. */
function layersOf(nodes: LayoutNode[], edges: LayoutEdge[]) {
  const layer = new Map(nodes.map(({ id }) => [id, 0]));

  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;

    for (const { from, to } of edges) {
      const next = layer.get(from)! + 1;

      if (layer.has(to) && next > layer.get(to)! && next < nodes.length) {
        layer.set(to, next);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }

  return layer;
}

/**
 * Layered left-to-right layout: columns by dependency depth, rows ordered by the average
 * row of each card's parents so edges cross less. Returns top-left positions.
 */
export function tidyLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): Map<string, { x: number; y: number }> {
  const known = new Set(nodes.map(({ id }) => id));
  const usable = edges.filter(
    ({ from, to }) => from !== to && known.has(from) && known.has(to),
  );
  const layer = layersOf(nodes, usable);
  const columns: LayoutNode[][] = [];

  for (const node of nodes) {
    (columns[layer.get(node.id)!] ??= []).push(node);
  }

  const parents = new Map<string, string[]>();

  for (const { from, to } of usable) {
    parents.set(to, [...(parents.get(to) ?? []), from]);
  }

  const center = new Map<string, number>();
  const positions = new Map<string, { x: number; y: number }>();
  let x = 0;

  for (const column of columns) {
    if (!column?.length) {
      continue;
    }

    const rank = (node: LayoutNode) => {
      const ys = (parents.get(node.id) ?? [])
        .map((id) => center.get(id))
        .filter((y): y is number => y !== undefined);

      return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : Infinity;
    };
    const ordered = [...column].sort((a, b) => rank(a) - rank(b));
    let y = 0;

    for (const node of ordered) {
      positions.set(node.id, { x, y });
      center.set(node.id, y + node.height / 2);
      y += node.height + ROW_GAP;
    }

    x += Math.max(...column.map(({ width }) => width)) + COLUMN_GAP;
  }

  return positions;
}
