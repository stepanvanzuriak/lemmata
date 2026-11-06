import { expect, it } from "vitest";
import {
  abortStaleAttempts,
  createProject,
  finishAttempt,
  listAttempts,
  MIGRATIONS_FOLDER,
  openDb,
  startAttempt,
} from "../index.js";

it("marks attempts left running by a previous daemon as aborted", async () => {
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  const project = await createProject(db, { title: "P", statement: "S" });
  const stale = await startAttempt(db, { projectId: project.id, title: "a" });
  const done = await startAttempt(db, { projectId: project.id, title: "b" });
  await finishAttempt(db, done.id, "done");

  expect(await abortStaleAttempts(db)).toBe(1);

  const rows = new Map((await listAttempts(db)).map((a) => [a.id, a]));
  expect(rows.get(stale.id)).toMatchObject({ status: "aborted" });
  expect(rows.get(stale.id)!.finishedAt).toBeTruthy();
  expect(rows.get(done.id)).toMatchObject({ status: "done" });
});
