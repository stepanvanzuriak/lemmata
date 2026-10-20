import { expect, it } from "vitest";
import { tidyLayout } from "../../lib/layout";

const box = (id: string) => ({ id, width: 100, height: 50 });

it("puts each card in a later column than the cards it links from", () => {
  const p = tidyLayout(
    [box("goal"), box("h1"), box("check")],
    [
      { from: "goal", to: "h1" },
      { from: "h1", to: "check" },
    ],
  );

  expect(p.get("goal")!.x).toBeLessThan(p.get("h1")!.x);
  expect(p.get("h1")!.x).toBeLessThan(p.get("check")!.x);
});

it("never overlaps cards in a column and survives cycles", () => {
  const p = tidyLayout(
    [box("a"), box("b"), box("c")],
    [
      { from: "a", to: "b" },
      { from: "b", to: "a" },
      { from: "a", to: "c" },
    ],
  );

  expect(p.size).toBe(3);
  expect(new Set([...p.values()].map(({ x, y }) => `${x},${y}`)).size).toBe(3);
});
