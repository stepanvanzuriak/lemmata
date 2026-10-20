import { expect, it } from "vitest";
import { tidyLayout } from "../../lib/layout";

const box = (id: string, height = 50) => ({ id, width: 100, height });

const overlap = (
  a: { x: number; y: number; height: number },
  b: { x: number; y: number; height: number },
) =>
  a.x < b.x + 100 &&
  b.x < a.x + 100 &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

it("puts each card in a later column than the cards it links from", async () => {
  const p = await tidyLayout(
    [box("goal"), box("h1"), box("check")],
    [
      { from: "goal", to: "h1" },
      { from: "h1", to: "check" },
    ],
  );

  expect(p.get("goal")!.x).toBeLessThan(p.get("h1")!.x);
  expect(p.get("h1")!.x).toBeLessThan(p.get("check")!.x);
});

it("never overlaps cards of different heights and survives cycles and stray edges", async () => {
  const nodes = [box("a"), box("b", 200), box("c", 120), box("d")];
  const p = await tidyLayout(nodes, [
    { from: "a", to: "b" },
    { from: "b", to: "a" },
    { from: "a", to: "c" },
    { from: "a", to: "d" },
    { from: "a", to: "a" },
    { from: "a", to: "gone" },
  ]);
  const placed = nodes.map((n) => ({ ...n, ...p.get(n.id)! }));

  expect(p.size).toBe(4);
  for (const [i, a] of placed.entries()) {
    for (const b of placed.slice(i + 1)) {
      expect(overlap(a, b)).toBe(false);
    }
  }
});
