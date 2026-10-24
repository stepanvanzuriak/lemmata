import { expect, it } from "vitest";
import { attackParent, expandCommand, parseCommand } from "../../agents.js";
import { createCards, updateCard } from "../../cards/apply.js";
import { archiveCards } from "../../cards/archive.js";
import { findCard } from "../../cards/find.js";
import { loadDetail } from "../../cards/load.js";
import { editRight } from "../../cards/rights.js";
import { canvasSetup } from "./helpers.js";

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
