import { updateNode } from "core";
import { expect, it } from "vitest";
import { createCards } from "../../cards/apply.js";
import { describeOne } from "../../cards/describe.js";
import { attackProgressAt, frontierContext } from "../../cards/frontier.js";
import { loadDetail } from "../../cards/load.js";
import {
  describeProgress,
  markStepDone,
  setProgress,
} from "../../cards/progress.js";
import { fieldsOf } from "../../cards/types.js";
import { canvasSetup } from "./helpers.js";

const passed = {
  run: {
    ok: true,
    output: {
      stdout: "",
      stderr: "",
      exitCode: 0,
      timedOut: false,
      durationMs: 1,
    },
    badge: "Passed",
    runAt: "2026-01-01T00:00:00.000Z",
  },
};

async function withAttack() {
  const setup = await canvasSetup({ role: "prover", agentId: "a1" });
  await createCards(setup.db, setup.run, [
    { kind: "hypothesis", title: "Main" },
  ]);
  const [attack, good, unrun] = await createCards(setup.db, setup.run, [
    { kind: "attack", title: "Route", connectFrom: "H1" },
    { kind: "lean", title: "Helper", source: "", connectFrom: "A1" },
    { kind: "lean", title: "Main claim", source: "sorry", connectFrom: "A1" },
  ]);
  await updateNode(setup.db, good!.id, passed);
  return { ...setup, attack: attack!, good: good!, unrun: unrun! };
}

it("requires checked evidence for every established result", async () => {
  const { db, run, good, unrun } = await withAttack();

  await expect(
    setProgress(db, run, "A1", {
      established: [
        { text: "Helper identity", evidence: [good.id] },
        { text: "Main claim", evidence: [unrun.id] },
      ],
      remaining: [],
    }),
  ).rejects.toThrow(/"Main claim": .* \(its check has not passed\)/);
  await expect(
    setProgress(db, run, "A1", {
      established: [{ text: "Prose step", evidence: ["H1"] }],
      remaining: [],
    }),
  ).rejects.toThrow("(it is open)");
  await expect(
    setProgress(db, run, "goal", { established: [], remaining: [] }),
  ).rejects.toThrow("Progress is kept on hypotheses and attacks");
});

it("records progress, moves advancedAt only on new results, and shows it to agents", async () => {
  const { db, run, attack, good } = await withAttack();
  const first = await setProgress(db, run, "A1", {
    established: [{ text: "Helper identity", evidence: ["Helper"] }],
    remaining: ["Main claim"],
    next: "Formalize the chain rule",
  });
  expect(first.advanced).toBe(true);
  const progress = fieldsOf(first.card).progress!;
  expect(progress).toMatchObject({
    established: [{ text: "Helper identity", evidence: [good.id] }],
    remaining: ["Main claim"],
    next: "Formalize the chain rule",
  });

  const again = await setProgress(db, run, "A1", {
    established: [{ text: "helper identity ", evidence: [good.id] }],
    remaining: ["Main claim, now only the limit"],
  });
  expect(again.advanced).toBe(false);
  expect(fieldsOf(again.card).progress!.advancedAt).toBe(progress.advancedAt);

  const detail = await loadDetail(db, run.canvasId);
  const current = detail.nodes.find((n) => n.id === attack.id)!;
  expect(attackProgressAt(detail, current)).toBe(progress.advancedAt);
  const described = describeOne(again.card, detail, run.author);
  expect(described).toContain("progress (updated");
  expect(described).toContain(`- helper identity [${good.id}]`);
  expect(described).toContain("- Main claim, now only the limit");
  expect(
    frontierContext(detail, current, 0, [
      { title: "/prover A1", startedAt: "9999-01-01" },
    ]),
  ).toContain("Continue from its progress record");
});

it("keeps steps the user marked done across agent updates, and undoes the mark", async () => {
  const { db, run, attack, good } = await withAttack();
  await setProgress(db, run, "A1", {
    established: [{ text: "Helper identity", evidence: [good.id] }],
    remaining: ["Chain rule", "Tail limit"],
    next: "Chain rule",
  });

  const marked = await markStepDone(db, attack.id, "Chain rule", true);
  expect(fieldsOf(marked!).progress).toMatchObject({
    remaining: ["Tail limit"],
    done: [{ text: "Chain rule" }],
  });
  expect(fieldsOf(marked!).progress?.next).toBeUndefined();

  // An agent that still lists the step does not bring it back.
  const { card } = await setProgress(db, run, "A1", {
    established: [{ text: "Helper identity", evidence: [good.id] }],
    remaining: ["chain rule", "Tail limit"],
    next: "Chain rule",
  });
  expect(fieldsOf(card).progress).toMatchObject({
    remaining: ["Tail limit"],
    done: [{ text: "Chain rule" }],
  });
  expect(fieldsOf(card).progress?.next).toBeUndefined();
  expect(
    describeProgress(
      fieldsOf(card).progress!,
      await loadDetail(db, run.canvasId),
    ).join("\n"),
  ).toContain("marked done by the user");

  const undone = await markStepDone(db, attack.id, "Chain rule", false);
  expect(fieldsOf(undone!).progress?.remaining).toEqual([
    "Tail limit",
    "Chain rule",
  ]);
  expect(fieldsOf(undone!).progress?.done).toBeUndefined();
});
