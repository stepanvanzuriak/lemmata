import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  createProject,
  deleteProject,
  listCanvases,
  startAttempt,
  openDb,
  MIGRATIONS_FOLDER,
  addAttemptEvent,
  listAttemptEvents,
} from "../index.js";

it("persists complete events across reconnects, orders pages, isolates attempts and cascades deletes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lemmata-transcripts-"));
  const url = `file:${join(dir, "test.db")}`;
  const db = await openDb(url, MIGRATIONS_FOLDER);
  const project = await createProject(db, { title: "P" });
  const [canvas] = await listCanvases(db, project.id);
  const input = {
    projectId: project.id,
    canvasId: canvas!.id,
    title: "/prover H32",
  };
  const first = await startAttempt(db, input);
  const second = await startAttempt(db, input);
  const long = "x".repeat(20_000);
  await addAttemptEvent(db, first.id, "tool_use", {
    name: "create_cards",
    input: long,
  });
  await addAttemptEvent(db, second.id, "text", { text: "other run" });
  await addAttemptEvent(db, first.id, "tool_result", {
    output: long,
    isError: false,
  });

  const reopened = await openDb(url, MIGRATIONS_FOLDER);
  const page = await listAttemptEvents(reopened, first.id, 0, 1);
  expect(page).toHaveLength(1);
  expect(page[0]!.data).toEqual({ name: "create_cards", input: long });
  const next = await listAttemptEvents(reopened, first.id, page[0]!.id);
  expect(next).toHaveLength(1);
  expect(next[0]!.kind).toBe("tool_result");
  expect(next[0]!.data).toEqual({ output: long, isError: false });
  expect(next[0]!.id).toBeGreaterThan(page[0]!.id);
  await deleteProject(db, project.id);
  expect(await listAttemptEvents(reopened, first.id)).toEqual([]);
});
