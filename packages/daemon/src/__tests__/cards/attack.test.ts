import { addEdge, updateNode, type Db } from "core";
import { expect, it } from "vitest";
import { attackParent, expandCommand, parseCommand } from "../../agents.js";
import { createCards, updateCard } from "../../cards/apply.js";
import {
  archiveCards,
  archiveFailedAttackChecks,
} from "../../cards/archive.js";
import { findCard } from "../../cards/find.js";
import { loadDetail } from "../../cards/load.js";
import { editRight } from "../../cards/rights.js";
import type { RunContext } from "../../cards/types.js";
import { canvasSetup } from "./helpers.js";

async function connectH1(db: Db, run: RunContext, id: string) {
  const detail = await loadDetail(db, run.canvasId);
  await addEdge(db, {
    canvasId: run.canvasId,
    fromNode: findCard(detail, "H1")!.id,
    toNode: id,
    kind: "tested-by",
  });
}

async function withAttack() {
  const setup = await canvasSetup({ role: "prover" });
  const [h, a] = await createCards(setup.db, setup.run, [
    { kind: "hypothesis", title: "Dense piece" },
    {
      kind: "attack",
      title: "Cell decomposition",
      markdown: "Split the grid into cells.",
      connectFrom: "H1",
    },
  ]);

  return { ...setup, h: h!, a: a! };
}

it("creates an open attack labelled A1 and linked from its hypothesis", async () => {
  const { db, run, h, a } = await withAttack();
  const detail = await loadDetail(db, run.canvasId);

  expect(a.payload).toMatchObject({ label: "A1", status: "open" });
  expect(detail.edges).toContainEqual(
    expect.objectContaining({
      fromNode: h.id,
      toNode: a.id,
      kind: "depends-on",
    }),
  );
  expect(attackParent(detail, a)?.id).toBe(h.id);

  const [second] = await createCards(db, run, [
    { kind: "attack", title: "Inverse step", connectFrom: "H1" },
  ]);
  expect(second!.payload).toMatchObject({ label: "A2" });
  expect(findCard(detail, "a1")?.id).toBe(a.id);
});

it("lets a prover settle an attack but not rewrite its title", async () => {
  const { db, run, a } = await withAttack();

  expect(editRight({ ...a, createdBy: "user" }, run.author)).toBe("body");
  await expect(
    updateCard(db, run, "A1", { status: "failed", markdown: "No density." }),
  ).resolves.toMatchObject({ payload: { status: "failed" } });
  await expect(
    updateCard(db, run, "A1", { title: "Something else" }),
  ).rejects.toThrow("You may only change the status, text and markdown of A1.");
  await expect(updateCard(db, run, "A1", { status: "proved" })).rejects.toThrow(
    "Status of a attack must be one of: open, worked, failed.",
  );
});

it("refuses to mark an attack worked while its checks have not passed", async () => {
  const { db, run } = await withAttack();
  await createCards(db, run, [
    { kind: "python", title: "search", source: "", connectFrom: "A1" },
  ]);

  await expect(updateCard(db, run, "A1", { status: "worked" })).rejects.toThrow(
    "A1 cannot be marked worked yet",
  );
});

it("asks the prover to carry out the attack on its hypothesis", async () => {
  const { db, run, a } = await withAttack();
  const detail = await loadDetail(db, run.canvasId);
  const prompt = expandCommand(parseCommand("/prover A1")!, a, detail);

  expect(prompt).toContain("Carry out the attack attack A1");
  expect(prompt).toContain('on hypothesis H1 "Dense piece"');
});

it("archives only failed attacks", async () => {
  const { db, run, a } = await withAttack();
  const curator = { ...run, author: { role: "curator" as const } };

  const open = await archiveCards(db, curator, [a.id], "dead end");
  expect(open.archived).toEqual([]);
  expect(open.refused[0]).toContain("only failed attacks are archived");

  await updateCard(db, run, "A1", { status: "failed" });

  const failed = await archiveCards(db, curator, [a.id], "dead end");
  expect(failed.archived.map((n) => n.id)).toEqual([a.id]);
});

it("hangs a hypothesis created under an attack from the attack's hypothesis", async () => {
  const { db, run } = await canvasSetup({ role: "prover", agentId: "a1" });
  const [h1] = await createCards(db, run, [
    { kind: "hypothesis", title: "Main" },
  ]);
  const [attack] = await createCards(db, run, [
    { kind: "attack", title: "Route", connectFrom: "H1" },
  ]);
  const notices: string[] = [];

  const [lemma, check] = await createCards(
    db,
    { ...run, target: attack!.id },
    [
      { kind: "hypothesis", title: "Local lemma" },
      {
        kind: "lean",
        title: "Local lemma statement",
        source: "",
        connectFrom: "H2",
      },
    ],
    notices,
  );
  const { edges } = await loadDetail(db, run.canvasId);

  expect(edges).toContainEqual(
    expect.objectContaining({
      fromNode: h1!.id,
      toNode: lemma!.id,
      kind: "depends-on",
    }),
  );
  expect(
    edges.some((e) => e.fromNode === attack!.id && e.toNode === lemma!.id),
  ).toBe(false);
  expect(edges).toContainEqual(
    expect.objectContaining({
      fromNode: lemma!.id,
      toNode: check!.id,
      kind: "tested-by",
    }),
  );
  expect(notices).toEqual([expect.stringContaining("not from the attack")]);
});

it("archives the never-passed checks that only a failed attack needed", async () => {
  const { db, run } = await canvasSetup({ role: "prover", agentId: "a1" });
  await createCards(db, run, [{ kind: "hypothesis", title: "Main" }]);
  const [attack] = await createCards(db, run, [
    { kind: "attack", title: "Route", connectFrom: "H1" },
  ]);
  const [obligation, passed, shared] = await createCards(db, run, [
    { kind: "lean", title: "Main claim", source: "sorry", connectFrom: "A1" },
    { kind: "python", title: "Diagnostic", source: "", connectFrom: "A1" },
    { kind: "python", title: "Also for H1", source: "", connectFrom: "A1" },
  ]);
  await updateNode(db, passed!.id, {
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
      runAt: "2026-01-01",
    },
  });
  await connectH1(db, run, shared!.id);
  const failed = await updateCard(db, run, "A1", { status: "failed" });

  const dropped = await archiveFailedAttackChecks(db, run, failed);
  expect(dropped.map((c) => c.id)).toEqual([obligation!.id]);
  const detail = await loadDetail(db, run.canvasId);
  const archived = (id: string) =>
    Boolean(detail.nodes.find((n) => n.id === id)!.payload.archived);
  expect(archived(obligation!.id)).toBe(true);
  expect(archived(passed!.id)).toBe(false);
  expect(archived(shared!.id)).toBe(false);
  expect(archived(attack!.id)).toBe(false);
});
