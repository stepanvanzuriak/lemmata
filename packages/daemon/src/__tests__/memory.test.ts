import {
  addMemory,
  createProject,
  MIGRATIONS_FOLDER,
  openDb,
  updateMemory,
} from "core";
import { expect, it } from "vitest";
import { memoryPreamble } from "../memory.js";

async function setup() {
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  const project = await createProject(db, { title: "Collatz" });
  return { db, project };
}

it("is empty without memory", async () => {
  const { db, project } = await setup();
  expect(await memoryPreamble(db, project.id)).toBe("");
});

it("lists pinned entries first, then newest, one line each with its kind", async () => {
  const { db, project } = await setup();

  for (const entry of [
    { kind: "fact", text: "old fact" },
    { kind: "dead-end", text: "pinned\ndead end" },
    { kind: "idea", text: "new idea" },
  ] as const) {
    await addMemory(db, project.id, [entry]);
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  const pinned = (await db.query.memoryEntry.findFirst({
    where: { kind: "dead-end" },
  }))!;
  await updateMemory(db, pinned.id, { pinned: true });

  expect(await memoryPreamble(db, project.id)).toBe(
    [
      "Research memory for this project:",
      "- [dead-end] pinned dead end",
      "- [idea] new idea",
      "- [fact] old fact",
    ].join("\n"),
  );
});

it("stays within the budget and keeps pinned entries", async () => {
  const { db, project } = await setup();
  const [pinned] = await addMemory(db, project.id, [
    { kind: "fact", text: "keep me" },
  ]);
  await updateMemory(db, pinned!.id, { pinned: true });

  for (let i = 0; i < 50; i++) {
    await addMemory(db, project.id, [
      { kind: "idea", text: `idea number ${i}` },
    ]);
  }

  const preamble = await memoryPreamble(db, project.id, 200);
  expect(preamble.length).toBeLessThanOrEqual(200);
  expect(preamble.split("\n")[1]).toBe("- [fact] keep me");
  expect(preamble.split("\n").length).toBeGreaterThan(3);
});
