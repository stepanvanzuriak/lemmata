import { expect, it } from "vitest";
import type { CanvasNode, NodeKind } from "shared";
import { cardSize, LAYER_GAP, NODE_GAP, tidyLayout } from "shared/layout";
import { freeSpot } from "../../cards/place.js";

function node(
  id: string,
  kind: NodeKind,
  x: number,
  y: number,
  w = 0,
  h = 0,
): CanvasNode {
  return { id, kind, x, y, w, h } as CanvasNode;
}

it("uses Tidy spacing and aligns the new card with its actual parent", async () => {
  const parent = node("parent", "hypothesis", 750, -320, 480, 260);
  const positions = await tidyLayout(
    [
      { id: parent.id, ...cardSize(parent) },
      { id: "new", ...cardSize({ kind: "note" }) },
    ],
    [{ from: parent.id, to: "new" }],
  );
  const result = await freeSpot([parent], parent, "note");
  const anchor = positions.get(parent.id)!;
  const proposed = positions.get("new")!;
  expect(result).toEqual({
    x: parent.x + proposed.x - anchor.x,
    y: parent.y + proposed.y - anchor.y,
  });
  expect(result.x).toBe(parent.x + parent.w + LAYER_GAP);
});

it("avoids tall measured cards without moving existing cards", async () => {
  const parent = node("parent", "hypothesis", 0, 0);
  const blocker = node("blocker", "python", 460, -300, 700, 1000);
  const nodes = [parent, blocker];
  const before = structuredClone(nodes);
  const result = await freeSpot(nodes, parent, "note");
  const size = cardSize({ kind: "note" });
  expect(
    result.x >= blocker.x + blocker.w + NODE_GAP ||
      result.x + size.width + NODE_GAP <= blocker.x ||
      result.y + size.height + NODE_GAP <= blocker.y ||
      result.y >= blocker.y + blocker.h + NODE_GAP,
  ).toBe(true);
  expect(nodes).toEqual(before);
});

it("keeps sequential siblings close to the parent without overlapping", async () => {
  const parent = node("parent", "goal", -100, 200);
  const nodes = [parent];
  for (let i = 0; i < 5; i++) {
    const position = await freeSpot(nodes, parent, "statement");
    const child = node(`child${i}`, "statement", position.x, position.y);
    nodes.push(child);
  }
  const children = nodes.slice(1);
  for (const [index, child] of children.entries()) {
    expect(Math.abs(child.y - parent.y)).toBeLessThanOrEqual(200);
    for (const other of children.slice(index + 1)) {
      expect(
        child.x + 300 + NODE_GAP <= other.x ||
          other.x + 300 + NODE_GAP <= child.x ||
          child.y + 150 + NODE_GAP <= other.y ||
          other.y + 150 + NODE_GAP <= child.y,
      ).toBe(true);
    }
  }
});

it("uses space above the parent when a tall card blocks the space below", async () => {
  const parent = node("parent", "goal", 0, 0);
  const blocker = node("blocker", "toolbox", 440, 0, 600, 10000);
  const result = await freeSpot([parent, blocker], parent, "statement");
  expect(
    result.y + cardSize({ kind: "statement" }).height + NODE_GAP,
  ).toBeLessThanOrEqual(blocker.y);
});

it("handles a parent named like the temporary layout node", async () => {
  const parent = node("__new_card__", "hypothesis", 10, 20);
  const other = node("other", "hypothesis", 460, 0);
  const result = await freeSpot([parent, other], parent, "lean");
  expect(Number.isFinite(result.x) && Number.isFinite(result.y)).toBe(true);
  expect(result.x).toBeGreaterThanOrEqual(
    parent.x + cardSize(parent).width + LAYER_GAP,
  );
});

it("does not let distant branches pull a new card away from its target", async () => {
  const parent = node("parent", "hypothesis", 1200, -2400);
  const distant = Array.from({ length: 20 }, (_, i) =>
    node(`distant${i}`, "toolbox", 1660, i * 1000, 600, 800),
  );
  const result = await freeSpot([parent, ...distant], parent, "statement");
  expect(result).toEqual({
    x: parent.x + cardSize(parent).width + LAYER_GAP,
    y: parent.y,
  });
});

it("uses a nearby column instead of making a huge vertical jump around a tall blocker", async () => {
  const parent = node("parent", "hypothesis", 0, 0);
  const blocker = node("blocker", "toolbox", 460, -5000, 300, 10000);
  const result = await freeSpot([parent, blocker], parent, "statement");
  expect(result.y).toBe(parent.y);
  expect(result.x).toBeGreaterThanOrEqual(blocker.x + blocker.w + NODE_GAP);
  expect(result.x - parent.x).toBeLessThan(1000);
});
