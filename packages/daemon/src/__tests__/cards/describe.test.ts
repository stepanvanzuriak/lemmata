import { expect, it } from "vitest";
import { createCards } from "../../cards/apply.js";
import { describeCanvas, describeOne } from "../../cards/describe.js";
import { findCard } from "../../cards/find.js";
import { loadDetail } from "../../cards/load.js";
import { canvasSetup } from "./helpers.js";

it("describes cards, rights and links", async () => {
  const { db, run } = await canvasSetup();
  await createCards(db, run, [{ kind: "hypothesis", title: "Orbits shrink" }]);
  const detail = await loadDetail(db, run.canvasId);
  const text = describeCanvas(detail, run.author);

  expect(text).toContain(
    'goal · "Collatz" · status: Open · you may change: none',
  );
  expect(text).toContain("H1");
  expect(text).toContain("you may change: all");
  expect(text).toContain("- goal depends-on H1".replace("goal", '"Collatz"'));
  expect(describeOne(findCard(detail, "H1")!, detail, run.author)).toContain(
    "Links:",
  );
});

it.each(["python", "lean", "toolbox"] as const)(
  "reads long %s card bodies and code without truncation",
  async (kind) => {
    const { db, run } = await canvasSetup();
    const long = "x".repeat(20_000) + "END";
    const [card] = await createCards(db, run, [
      {
        kind,
        title: "Long card",
        text: long,
        markdown: long,
        ...(kind === "toolbox"
          ? { python: long, lean: long }
          : { source: long }),
      },
    ]);
    const detail = await loadDetail(db, run.canvasId);
    const text = describeOne(card!, detail, run.author);

    expect(text).toContain(`  text: ${long}`);
    expect(text).toContain(`  markdown: ${long}`);
    if (kind === "toolbox") {
      expect(text).toContain(`  reusable Python:\n${long}`);
      expect(text).toContain(`  reusable Lean:\n${long}`);
    } else {
      expect(text).toContain(`  source:\n${long}`);
    }
    expect(text).not.toContain("more chars]");
    expect(describeCanvas(detail, run.author, [card!.id])).toContain(
      "more chars]",
    );
  },
);

it("stays under the budget with many long cards", async () => {
  const { db, run } = await canvasSetup();
  const long = "x".repeat(5_000);

  for (let i = 0; i < 5; i++) {
    await createCards(
      db,
      run,
      Array.from({ length: 8 }, (_, j) => ({
        kind: "statement" as const,
        title: `S${i}-${j}`,
        text: long,
        markdown: long,
      })),
    );
  }

  const detail = await loadDetail(db, run.canvasId);
  const text = describeCanvas(detail, run.author, [], 20_000);

  expect(detail.nodes).toHaveLength(41);
  expect(text.length).toBeLessThan(20_000 + 8_000);
  expect(text).toContain('"S4-7"');
});
