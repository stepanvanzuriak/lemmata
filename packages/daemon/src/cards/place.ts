import type { CanvasNode, NodeKind } from "shared";

const WIDTH: Record<NodeKind, number> = {
  goal: 320,
  hypothesis: 340,
  statement: 300,
  note: 250,
  memory: 320,
  arxiv: 290,
  python: 290,
  lean: 290,
};

const HEIGHT: Partial<Record<NodeKind, number>> = { python: 200, lean: 200 };
const DEFAULT_HEIGHT = 150;
const GAP = 60;

type Box = Pick<CanvasNode, "x" | "y" | "kind">;

const width = (n: Box) => WIDTH[n.kind] ?? 300;
const height = (n: Box) => HEIGHT[n.kind] ?? DEFAULT_HEIGHT;

function overlaps(a: Box, b: Box) {
  return (
    a.x < b.x + width(b) + GAP / 2 &&
    b.x < a.x + width(a) + GAP / 2 &&
    a.y < b.y + height(b) + GAP / 2 &&
    b.y < a.y + height(a) + GAP / 2
  );
}

/** Right of the parent, stepping down past cards it would overlap (heights are estimates). */
export function freeSpot(
  nodes: Box[],
  parent: Box | undefined,
  kind: NodeKind,
): { x: number; y: number } {
  const spot: Box = {
    kind,
    x: parent ? parent.x + width(parent) + GAP * 2 : 0,
    y: parent ? parent.y : 0,
  };

  while (nodes.some((n) => overlaps(spot, n))) {
    spot.y += DEFAULT_HEIGHT + GAP;
  }

  return { x: spot.x, y: spot.y };
}
