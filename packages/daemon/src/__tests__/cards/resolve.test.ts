import { expect, it } from "vitest";
import { createCards } from "../../cards/apply.js";
import { describeCanvas } from "../../cards/describe.js";
import { loadDetail } from "../../cards/load.js";
import { noteTarget, resolveNote } from "../../cards/resolve.js";
import { canvasSetup } from "./helpers.js";

async function refereed() {
  const { db, run } = await canvasSetup({ role: "referee", agentId: "ref1" });
  const [h1, note, plain] = await createCards(db, run, [
    { kind: "hypothesis", title: "Small orbits" },
    {
      kind: "note",
      title: "Referee: H1 has no argument",
      markdown: "The card states no lemma and no reduction.",
      connectFrom: "H1",
      edgeKind: "checked-by",
    },
    { kind: "note", title: "A loose remark", connectFrom: "H1" },
  ]);

  return { db, run, h1: h1!, note: note!, plain: plain! };
}

it("finds the card a referee note is about, and only for checked-by notes", async () => {
  const { db, run, h1, note, plain } = await refereed();
  const detail = await loadDetail(db, run.canvasId);

  expect(noteTarget(detail, note)?.id).toBe(h1.id);
  expect(noteTarget(detail, plain)).toBeUndefined();
  expect(noteTarget(detail, h1)).toBeUndefined();
});

it("a prover resolves a referee note once; the referee cannot close its own", async () => {
  const { db, run, h1, note, plain } = await refereed();
  const prover = {
    ...run,
    author: { role: "prover" as const, agentId: "p1" },
    attemptId: "att1",
  };

  await expect(resolveNote(db, run, note.id, "looks fine")).rejects.toThrow(
    /does not close its own notes/,
  );
  await expect(resolveNote(db, prover, plain.id, "n/a")).rejects.toThrow(
    /not a referee note/,
  );
  await expect(resolveNote(db, prover, "nope", "n/a")).rejects.toThrow(
    /No card matches/,
  );

  const { note: resolved, target } = await resolveNote(
    db,
    prover,
    note.id,
    "H1 now states the lemma and the reduction",
  );

  expect(target.id).toBe(h1.id);
  expect(resolved.payload).toMatchObject({
    resolved: {
      by: "att1",
      reason: "H1 now states the lemma and the reduction",
    },
  });
  await expect(resolveNote(db, prover, note.id, "again")).rejects.toThrow(
    /already resolved/,
  );
});

it("keeps a resolved note on the canvas but drops its body from the prompt", async () => {
  const { db, run, note } = await refereed();
  const prover = {
    ...run,
    author: { role: "prover" as const, agentId: "p1" },
  };

  const before = describeCanvas(await loadDetail(db, run.canvasId), run.author);
  expect(before).toContain("The card states no lemma");

  await resolveNote(db, prover, note.id, "answered on H1");
  const after = describeCanvas(await loadDetail(db, run.canvasId), run.author);

  expect(after).toContain("Referee: H1 has no argument");
  expect(after).toContain("resolved");
  expect(after).not.toContain("The card states no lemma");
});
