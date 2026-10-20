import { expect, it } from "vitest";
import {
  addMemory,
  createProject,
  deleteMemory,
  deleteProject,
  getMemory,
  listCanvases,
  listMemory,
  MIGRATIONS_FOLDER,
  openDb,
  startAttempt,
  updateMemory,
} from "../index.js";

async function setup() {
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  const project = await createProject(db, { title: "Collatz" });
  const [canvas] = await listCanvases(db, project.id);
  return { db, project, canvasId: canvas!.id };
}

it("stores an entry once, ignoring case and surrounding whitespace", async () => {
  const { db, project, canvasId } = await setup();
  const attempt = await startAttempt(db, {
    projectId: project.id,
    canvasId,
    title: "t",
  });

  const first = await addMemory(
    db,
    project.id,
    [{ kind: "fact", text: "Foo." }],
    { canvasId, attemptId: attempt.id },
  );
  const second = await addMemory(db, project.id, [
    { kind: "idea", text: " foo. " },
    { kind: "idea", text: "FOO." },
    { kind: "dead-end", text: "Induction on K loses a factor of K." },
  ]);

  expect(first).toHaveLength(1);
  expect(first[0]).toMatchObject({
    text: "Foo.",
    canvasId,
    attemptId: attempt.id,
    pinned: false,
  });
  expect(second.map((e) => e.text)).toEqual([
    "Induction on K loses a factor of K.",
  ]);
  expect(await listMemory(db)).toHaveLength(2);
});

it("allows the same text in different projects", async () => {
  const { db, project } = await setup();
  const other = await createProject(db, { title: "Other" });
  const entry = { kind: "fact", text: "Same" } as const;

  await addMemory(db, project.id, [entry]);
  expect(await addMemory(db, other.id, [entry])).toHaveLength(1);
});

it("filters by project and kind", async () => {
  const { db, project } = await setup();
  const other = await createProject(db, { title: "Other" });

  await addMemory(db, project.id, [{ kind: "fact", text: "a" }]);
  await addMemory(db, project.id, [{ kind: "dead-end", text: "b" }]);
  await addMemory(db, other.id, [{ kind: "fact", text: "c" }]);

  expect((await listMemory(db)).map((e) => e.text).sort()).toEqual([
    "a",
    "b",
    "c",
  ]);
  expect(
    (await listMemory(db, { projectId: project.id })).map((e) => e.text).sort(),
  ).toEqual(["a", "b"]);
  expect(
    (await listMemory(db, { kind: "fact" })).map((e) => e.text).sort(),
  ).toEqual(["a", "c"]);
  expect(
    await listMemory(db, { projectId: other.id, kind: "dead-end" }),
  ).toEqual([]);
});

it("updates and deletes an entry", async () => {
  const { db, project } = await setup();
  const [entry] = await addMemory(db, project.id, [
    { kind: "idea", text: "x" },
  ]);

  const updated = await updateMemory(db, entry!.id, {
    pinned: true,
    kind: "fact",
    text: " y ",
  });
  expect(updated).toMatchObject({ pinned: true, kind: "fact", text: "y" });
  expect(await getMemory(db, entry!.id)).toEqual(updated);

  expect(await updateMemory(db, "missing", { pinned: true })).toBeUndefined();
  expect(await deleteMemory(db, entry!.id)).toBe(true);
  expect(await deleteMemory(db, entry!.id)).toBe(false);
  expect(await listMemory(db)).toEqual([]);
});

it("is removed with its project", async () => {
  const { db, project } = await setup();
  await addMemory(db, project.id, [{ kind: "fact", text: "x" }]);
  await deleteProject(db, project.id);
  expect(await listMemory(db)).toEqual([]);
});
