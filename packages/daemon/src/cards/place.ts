import type { CanvasNode, NodeKind } from "shared";
import { cardSize, LAYER_GAP, NODE_GAP, tidyLayout } from "shared/layout";

type Box = Pick<CanvasNode, "x" | "y" | "kind"> &
  Partial<Pick<CanvasNode, "w" | "h">>;

const width = (n: Box) => cardSize(n).width;
const height = (n: Box) => cardSize(n).height;

function overlaps(a: Box, b: Box) {
  return (
    a.x < b.x + width(b) + NODE_GAP &&
    b.x < a.x + width(a) + NODE_GAP &&
    a.y < b.y + height(b) + NODE_GAP &&
    b.y < a.y + height(a) + NODE_GAP
  );
}

/** Lay out the new parent-child pair, then find nearby space among fixed cards. */
export async function freeSpot(
  nodes: CanvasNode[],
  parent: CanvasNode | undefined,
  kind: NodeKind,
): Promise<{ x: number; y: number }> {
  const spot: Box = {
    kind,
    x: parent ? parent.x + width(parent) + LAYER_GAP : 0,
    y: parent ? parent.y : 0,
  };

  if (parent) {
    const draftId =
      parent.id === "__new_card__" ? "__new_card_1__" : "__new_card__";
    const positions = await tidyLayout(
      [
        { id: parent.id, width: width(parent), height: height(parent) },
        { id: draftId, width: width(spot), height: height(spot) },
      ],
      [{ from: parent.id, to: draftId }],
    );
    const anchor = positions.get(parent.id)!;
    const suggested = positions.get(draftId)!;
    spot.x = Math.max(spot.x, parent.x + suggested.x - anchor.x);
    spot.y = parent.y + suggested.y - anchor.y;
  }

  // Search obstacle boundaries in nearby columns. A crowded column should not
  // send a card thousands of pixels above or below the card it belongs to.
  const columns = [
    ...new Set([
      spot.x,
      ...nodes.map((node) => node.x + width(node) + LAYER_GAP),
    ]),
  ]
    .filter((x) => x >= spot.x)
    .sort((a, b) => a - b);
  let best: { x: number; y: number; score: number } | undefined;
  for (const x of columns) {
    const horizontalDistance = (x - spot.x) ** 2;
    if (best && horizontalDistance >= best.score) {
      break;
    }
    const blockers = nodes.filter(
      (node) =>
        x < node.x + width(node) + NODE_GAP &&
        node.x < x + width(spot) + NODE_GAP,
    );
    const candidates = [
      spot.y,
      ...blockers.flatMap((node) => [
        node.y - height(spot) - NODE_GAP,
        node.y + height(node) + NODE_GAP,
      ]),
    ];
    candidates.sort(
      (a, b) => Math.abs(a - spot.y) - Math.abs(b - spot.y) || a - b,
    );
    const y = candidates.find((candidate) =>
      blockers.every((node) => !overlaps({ ...spot, x, y: candidate }, node)),
    )!;
    const score = horizontalDistance + 2 * (y - spot.y) ** 2;
    if (!best || score < best.score) {
      best = { x, y, score };
    }
  }
  return { x: best!.x, y: best!.y };
}
