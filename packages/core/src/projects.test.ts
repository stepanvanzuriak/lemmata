import { expect, it } from "vitest";
import { openDb } from "./db/index.js";
import { MIGRATIONS_FOLDER } from "./index.js";
import { createProject, deleteProject, listProjects } from "./projects.js";

it("creates, lists and deletes a project", async () => {
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);

  const created = await createProject(db, { title: "Collatz" });

  expect(created).toMatchObject({ title: "Collatz", statement: "", dir: null });
  expect(await listProjects(db)).toEqual([created]);

  await deleteProject(db, created.id);

  expect(await listProjects(db)).toEqual([]);
});
