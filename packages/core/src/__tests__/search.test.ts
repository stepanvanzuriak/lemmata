import { expect, it } from "vitest";
import { openDb } from "../db/index.js";
import { MIGRATIONS_FOLDER } from "../index.js";
import { createProject } from "../projects.js";
import { searchProjects } from "../search.js";

it("matches title and statement, ignoring case", async () => {
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  const a = await createProject(db, { title: "Collatz" });
  const b = await createProject(db, {
    title: "Other",
    statement: "Every orbit reaches COLLATZ cycle",
  });
  await createProject(db, { title: "Unrelated" });

  const ids = (await searchProjects(db, "collatz")).map((p) => p.id);

  expect(ids.sort()).toEqual([a.id, b.id].sort());
});

it("treats % and _ literally", async () => {
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  await createProject(db, { title: "abc" });

  expect(await searchProjects(db, "%")).toEqual([]);
});

it("caps results at 20", async () => {
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  for (let i = 0; i < 25; i++) {
    await createProject(db, { title: `Lemma ${i}` });
  }

  expect(await searchProjects(db, "lemma")).toHaveLength(20);
});
