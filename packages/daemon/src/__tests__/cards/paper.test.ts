import { expect, it } from "vitest";
import { ArxivError } from "../../arxiv/arxiv.js";
import { loadDetail } from "../../cards/load.js";
import { addPaper } from "../../cards/paper.js";
import { ToolRefusal } from "../../cards/types.js";
import { feedArxiv } from "../helpers/arxiv.js";
import { canvasSetup } from "./helpers.js";

it("adds a paper card with a used-by edge from the parent", async () => {
  const { db, run } = await canvasSetup();
  const goal = (await loadDetail(db, run.canvasId)).nodes[0]!;

  const card = await addPaper(db, feedArxiv, run, { id: "arXiv:1208.0053v3" });
  const detail = await loadDetail(db, run.canvasId);

  expect(card.kind).toBe("arxiv");
  expect(card.payload).toMatchObject({
    arxivId: "1208.0053",
    title: "On sets defining few ordinary lines",
    authors: ["Ben Green", "Terence Tao"],
    url: "https://arxiv.org/abs/1208.0053",
  });
  expect(card.payload).not.toHaveProperty("source");
  expect(detail.edges).toEqual([
    expect.objectContaining({
      fromNode: goal.id,
      toNode: card.id,
      kind: "used-by",
    }),
  ]);
});

it("returns the existing card instead of adding a duplicate", async () => {
  const { db, run } = await canvasSetup();
  const first = await addPaper(db, feedArxiv, run, { id: "1208.0053" });
  const second = await addPaper(db, feedArxiv, run, { id: "1208.0053v2" });

  expect(second.id).toBe(first.id);
  expect((await loadDetail(db, run.canvasId)).nodes).toHaveLength(2);
});

it("refuses an unknown paper, a non-id and an unknown parent", async () => {
  const { db, run } = await canvasSetup();

  await expect(
    addPaper(db, feedArxiv, run, { id: "2101.99999" }),
  ).rejects.toThrow(ToolRefusal);
  await expect(
    addPaper(db, feedArxiv, run, { id: "https://evil.test/x" }),
  ).rejects.toThrow(ArxivError);
  await expect(
    addPaper(db, feedArxiv, run, { id: "1208.0053", connectFrom: "H9" }),
  ).rejects.toThrow(ToolRefusal);
  expect((await loadDetail(db, run.canvasId)).nodes).toHaveLength(1);
});
