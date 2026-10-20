import { addNode, updateNode } from "core";
import { expect, it } from "vitest";
import { createCards } from "../../cards/apply.js";
import { archiveCards } from "../../cards/archive.js";
import { describeCanvas } from "../../cards/describe.js";
import { loadDetail } from "../../cards/load.js";
import { canvasSetup } from "./helpers.js";

it("archives dead ends and keeps what still matters", async () => {
  const { db, run } = await canvasSetup({ role: "curator" });
  const [h1, h2, check, note] = await createCards(db, run, [
    { kind: "hypothesis", title: "Dead route" },
    { kind: "hypothesis", title: "Live route" },
    {
      kind: "python",
      title: "backs H2",
      source: "print(1)",
      connectFrom: "H2",
    },
    { kind: "note", title: "H1 attempt 1", connectFrom: "H1" },
  ]);
  await updateNode(db, h1!.id, { status: "refuted" });
  await updateNode(db, h2!.id, { status: "supported" });
  const mine = await addNode(db, {
    canvasId: run.canvasId,
    kind: "note",
    payload: { title: "User note" },
    createdBy: "user",
  });

  const { archived, refused } = await archiveCards(
    db,
    { ...run, attemptId: "att1" },
    ["H1", note!.id, "H2", check!.id, mine.id, "goal", "nope"],
    "merged into H1 summary",
  );

  expect(archived.map((c) => c.id).sort()).toEqual([h1!.id, note!.id].sort());
  expect(refused).toEqual([
    "H2: it is supported; only refuted hypotheses are archived",
    '"backs H2": it is linked to H2, which is supported',
    '"User note": it is the user\'s card',
    '"Collatz": the goal stays',
    '"nope": no card matches',
  ]);

  const detail = await loadDetail(db, run.canvasId);
  const text = describeCanvas(detail, run.author);

  expect(detail.nodes.find((n) => n.id === note!.id)!.payload).toMatchObject({
    archived: { by: "att1", reason: "merged into H1 summary" },
  });
  expect(text).toContain("2 archived cards are hidden");
  expect(text).not.toContain("Dead route");
  expect(text).not.toContain("H1 attempt 1");
});
