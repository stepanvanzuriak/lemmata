import { expect, it } from "vitest";
import { createCards } from "../../cards/apply.js";
import { literatureCardFor, recordLiterature } from "../../cards/literature.js";
import { loadDetail } from "../../cards/load.js";
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
