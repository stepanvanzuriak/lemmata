import { expect, it } from "vitest";
import { createCards } from "../../cards/apply.js";
import { literatureCardFor, recordLiterature } from "../../cards/literature.js";
import { findCard } from "../../cards/find.js";
import { loadDetail } from "../../cards/load.js";
import { addPaper } from "../../cards/paper.js";
import { feedArxiv } from "../helpers/arxiv.js";
import { canvasSetup } from "./helpers.js";

it("lets any agent fill a literature card, once per target", async () => {
  const { db, run } = await canvasSetup({ role: "prover", agentId: "p1" });
  const [h1] = await createCards(db, run, [
    { kind: "hypothesis", title: "Few rich lines" },
  ]);
  const first = await literatureCardFor(
    db,
    await loadDetail(db, run.canvasId),
    h1!,
  );
  const again = await literatureCardFor(
    db,
    await loadDetail(db, run.canvasId),
    h1!,
  );

  const card = await recordLiterature(db, feedArxiv, run, {
    card: first.card.id,
    verdict: "related",
    summary: "Only the ordinary-lines analogue is known.",
    papers: [{ id: "arXiv:1208.0053v3", relevance: "Neighbouring structure." }],
  });

  expect(again.card.id).toBe(first.card.id);
  expect(card.payload).toMatchObject({
    verdict: "related",
    papers: [{ id: "1208.0053", title: "On sets defining few ordinary lines" }],
  });
});

it("accepts a paper card on the canvas as a source without asking arXiv", async () => {
  const { db, run } = await canvasSetup({ role: "prover", agentId: "p1" });
  const paper = await addPaper(db, feedArxiv, run, { id: "1208.0053" });
  const goal = findCard(await loadDetail(db, run.canvasId), "goal")!;
  const { card } = await literatureCardFor(
    db,
    await loadDetail(db, run.canvasId),
    goal,
  );
  const offline = { ...feedArxiv, byIds: async () => [] };

  const recorded = await recordLiterature(db, offline, run, {
    card: card.id,
    verdict: "related",
    summary: "Read in full.",
    papers: [{ id: "1208.0053", relevance: "Read the main theorem." }],
  });

  expect(paper.kind).toBe("arxiv");
  expect(recorded.payload).toMatchObject({
    papers: [{ id: "1208.0053", relevance: "Read the main theorem." }],
  });
});
