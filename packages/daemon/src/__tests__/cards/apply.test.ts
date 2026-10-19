import { expect, it } from "vitest";
import { createCards, updateCard } from "../../cards/apply.js";
import { loadDetail } from "../../cards/load.js";
import { goalNudge } from "../../cards/goal.js";
import { freeSpot } from "../../cards/place.js";
import { canvasSetup } from "./helpers.js";

it("creates linked cards with labels and ai ownership", async () => {
  const { db, run } = await canvasSetup();
  const [h, check] = await createCards(db, run, [
    { kind: "hypothesis", title: "Orbits shrink" },
    { kind: "python", title: "check", source: "print(1)", connectFrom: "H1" },
  ]);
  const detail = await loadDetail(db, run.canvasId);

  expect(h!.payload).toMatchObject({
    label: "H1",
    status: "open",
    agentId: "a1",
  });
  expect(h!.createdBy).toBe("ai");
  expect(detail.edges.map((e) => e.kind)).toEqual(["depends-on", "tested-by"]);
  expect(detail.edges[1]).toMatchObject({ fromNode: h!.id, toNode: check!.id });
});

it("keeps fields that a partial update leaves out", async () => {
  const { db, run } = await canvasSetup();
  await createCards(db, run, [
    { kind: "statement", title: "Lemma", text: "short", markdown: "long" },
  ]);

  const updated = await updateCard(db, run, "Lemma", { text: "shorter" });

  expect(updated.payload).toMatchObject({
    title: "Lemma",
    text: "shorter",
    markdown: "long",
  });
});

it("refuses to support a hypothesis whose checks have not passed", async () => {
  const { db, run } = await canvasSetup();
  await createCards(db, run, [
    { kind: "hypothesis", title: "Orbits shrink" },
    { kind: "python", title: "search", source: "", connectFrom: "H1" },
  ]);

  await expect(
    updateCard(db, run, "H1", { status: "supported" }),
  ).rejects.toThrow(
    'H1 cannot be supported yet: "search" has not passed. Run them with run_card first.',
  );
});

it("nudges once the last depends-on hypothesis is supported", async () => {
  const { db, run } = await canvasSetup();
  await createCards(db, run, [
    { kind: "hypothesis", title: "A" },
    { kind: "hypothesis", title: "B" },
  ]);

  await updateCard(db, run, "H1", { status: "supported" });
  expect(goalNudge(await loadDetail(db, run.canvasId))).toBeNull();

  await updateCard(db, run, "H2", { status: "supported" });
  expect(goalNudge(await loadDetail(db, run.canvasId))).toContain(
    "Set the goal's status to proved",
  );
});

it("places five cards under one parent without overlap", async () => {
  const { db, run } = await canvasSetup();
  const cards = await createCards(
    db,
    run,
    Array.from({ length: 5 }, (_, i) => ({
      kind: "statement" as const,
      title: `S${i}`,
    })),
  );
  const ys = cards.map((c) => c.y).sort((a, b) => a - b);

  for (let i = 1; i < ys.length; i++) {
    expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(150);
  }
  expect(new Set(cards.map((c) => c.x)).size).toBe(1);
  expect(freeSpot([], undefined, "note")).toEqual({ x: 0, y: 0 });
});

it("rejects an unknown parent and an empty batch", async () => {
  const { db, run } = await canvasSetup();

  await expect(
    createCards(db, run, [{ kind: "note", title: "x", connectFrom: "H9" }]),
  ).rejects.toThrow('No card matches connectFrom "H9"');
  await expect(createCards(db, run, [])).rejects.toThrow("between 1 and 8");
});
