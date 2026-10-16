import { afterEach, expect, it, vi } from "vitest";
import { openDb } from "./db/index.js";
import { MIGRATIONS_FOLDER } from "./index.js";
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from "./projects.js";

afterEach(() => {
  vi.useRealTimers();
});

it("creates, lists and deletes a project", async () => {
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);

  const created = await createProject(db, { title: "Collatz" });

  expect(created).toMatchObject({ title: "Collatz", statement: "", dir: null });
  expect(await listProjects(db)).toEqual([created]);

  await deleteProject(db, created.id);

  expect(await listProjects(db)).toEqual([]);
});

it("updates only the given fields and bumps updatedAt", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));

  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  const created = await createProject(db, {
    title: "Collatz",
    statement: "Every orbit reaches $1$.",
    dir: "~/collatz",
  });

  vi.setSystemTime(new Date("2026-10-02T00:00:00Z"));

  const updated = await updateProject(db, created.id, {
    title: "Collatz 3n+1",
  });

  expect(updated).toEqual({
    ...created,
    title: "Collatz 3n+1",
    updatedAt: "2026-10-02T00:00:00.000Z",
  });
});

it("clears the folder when dir is null", async () => {
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  const created = await createProject(db, { title: "Collatz", dir: "~/c" });

  const updated = await updateProject(db, created.id, { dir: null });

  expect(updated.dir).toBeNull();
});
