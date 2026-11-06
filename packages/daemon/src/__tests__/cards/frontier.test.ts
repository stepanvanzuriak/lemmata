import { updateNode } from "core";
import { expect, it } from "vitest";
import { createCards, updateCard } from "../../cards/apply.js";
import { findCard } from "../../cards/find.js";
import {
  ancestry,
  frontierContext,
  ATTACK_RUN_BUDGET,
  attackProgressAt,
  lastProgressAt,
  runsOn,
  STALL_RUNS,
  stalledProverRuns,
} from "../../cards/frontier.js";
import { loadDetail } from "../../cards/load.js";
import { fieldsOf } from "../../cards/types.js";
import { canvasSetup } from "./helpers.js";

async function chain() {
  const setup = await canvasSetup();
  await createCards(setup.db, setup.run, [
    { kind: "hypothesis", title: "Top" },
    { kind: "hypothesis", title: "Middle", connectFrom: "H1" },
    { kind: "attack", title: "Try it", connectFrom: "H2" },
  ]);
  return setup;
}

it("traces the depends-on chain from the goal to the target", async () => {
  const { db, run } = await chain();
  const detail = await loadDetail(db, run.canvasId);
  const attack = findCard(detail, "Try it")!;

  expect(ancestry(detail, attack).map((n) => fieldsOf(n).title)).toEqual([
    detail.nodes.find((n) => n.kind === "goal")!.payload.title,
    "Top",
    "Middle",
    "Try it",
  ]);
  expect(frontierContext(detail, attack, 0)).toContain(
    'goal → H1 "Top" → H2 "Middle" → A1 "Try it"',
  );
});

it("stamps settledAt only when a card moves to a settled status", async () => {
  const { db, run } = await chain();

  const failed = await updateCard(db, run, "Try it", { status: "failed" });
  expect(fieldsOf(failed).settledAt).toBeUndefined();

  const supported = await updateCard(db, run, "H2", { status: "supported" });
  const at = fieldsOf(supported).settledAt;
  expect(at).toBeDefined();

  // Editing a settled card keeps the time it was settled.
  const edited = await updateCard(db, run, "H2", {
    status: "supported",
    text: "now with details",
  });
  expect(fieldsOf(edited).settledAt).toBe(at);
  expect(lastProgressAt(await loadDetail(db, run.canvasId))).toBe(at);
});

const runs = (n: number, title = "/prover H2", startedAt = "9999-01-01") =>
  Array.from({ length: n }, () => ({ title, startedAt }));

it("asks for a strategy review once prover runs stall, but not on attacks", async () => {
  const { db, run } = await chain();
  const detail = await loadDetail(db, run.canvasId);
  const target = findCard(detail, "H2")!;
  const attack = findCard(detail, "Try it")!;

  expect(lastProgressAt(detail)).toBe(
    detail.nodes.find((n) => n.kind === "goal")!.createdAt,
  );
  expect(stalledProverRuns(detail, runs(3, "/referee H2"))).toBe(0);

  const stalled = stalledProverRuns(detail, runs(STALL_RUNS));
  expect(stalled).toBe(STALL_RUNS);
  expect(frontierContext(detail, target, stalled - 1)).not.toContain(
    "Strategy review",
  );
  expect(frontierContext(detail, target, stalled)).toContain(
    "Strategy review required",
  );
  expect(frontierContext(detail, attack, stalled)).not.toContain(
    "Strategy review",
  );
});

it("restarts the stall count after a reset, a review or archived progress", async () => {
  const { db, run } = await chain();
  const before = runs(STALL_RUNS, "/prover H2", "9000-01-01");
  const after = runs(2);
  let detail = await loadDetail(db, run.canvasId);

  expect(stalledProverRuns(detail, [...before, ...after])).toBe(STALL_RUNS + 2);
  expect(
    stalledProverRuns(detail, [
      ...before,
      { title: "/reset", startedAt: "9500-01-01" },
      ...after,
    ]),
  ).toBe(2);

  // A settled card hidden by a reset still counts as progress.
  const [done] = await createCards(db, run, [
    { kind: "attack", title: "Done", connectFrom: "H1" },
  ]);
  await updateNode(db, done!.id, {
    status: "worked",
    settledAt: "9500-01-01",
    archived: { at: "9600-01-01", reason: "reset" },
  });
  detail = await loadDetail(db, run.canvasId);
  expect(stalledProverRuns(detail, [...before, ...after])).toBe(2);
});

it("counts runs on an attack and enforces its budget on runs without progress", async () => {
  const { db, run } = await chain();
  let detail = await loadDetail(db, run.canvasId);
  const attack = findCard(detail, "Try it")!;
  const on = (ref: string, n: number, at = "9000-01-01") =>
    runs(n, `/prover ${ref} go on`, at);

  // By label or id, but not runs from before the card existed (reused labels).
  expect(
    runsOn(attack, [
      ...on("A1", 1),
      ...on(attack.id, 1),
      ...on("A2", 1),
      { title: "/prover A1", startedAt: "2000-01-01" },
    ]),
  ).toBe(2);

  expect(frontierContext(detail, attack, 0, [])).not.toContain("earlier run");
  const once = frontierContext(detail, attack, 0, on("A1", 1))!;
  expect(once).toContain("This attack has had 1 earlier run, 1 of them since");
  expect(once).toContain("no progress record yet");
  expect(once).not.toContain("run budget");

  const stalled = on("A1", ATTACK_RUN_BUDGET);
  expect(frontierContext(detail, attack, 0, stalled)).toContain(
    "Its run budget is spent",
  );
  // A request with instructions of its own is not cut short by the budget.
  expect(frontierContext(detail, attack, 0, stalled, true)).not.toContain(
    "run budget",
  );

  // A check that passed after those runs restarts the count.
  const [check] = await createCards(db, run, [
    { kind: "python", title: "helper", source: "", connectFrom: "A1" },
  ]);
  await updateNode(db, check!.id, {
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
      runAt: "9100-01-01",
    },
  });
  detail = await loadDetail(db, run.canvasId);
  expect(attackProgressAt(detail, attack)).toBe("9100-01-01");
  const after = [...stalled, ...on("A1", 1, "9200-01-01")];
  const context = frontierContext(detail, attack, 0, after)!;
  expect(context).toContain(
    `has had ${ATTACK_RUN_BUDGET + 1} earlier runs, 1 of them since`,
  );
  expect(context).not.toContain("run budget");
});

it("points a hypothesis run at its open attacks and their progress", async () => {
  const { db, run } = await chain();
  await updateCard(db, run, "A1", {
    markdown: "Route.\n\n## Progress\n**Established** x\n**Remaining** y",
  });
  const detail = await loadDetail(db, run.canvasId);

  expect(
    frontierContext(detail, findCard(detail, "H2")!, 0, runs(2, "/prover A1")),
  ).toContain(
    'Open attacks on this hypothesis: A1 "Try it" (2 runs, has progress)',
  );
  expect(frontierContext(detail, findCard(detail, "H1")!, 0, [])).not.toContain(
    "Open attacks",
  );
});
