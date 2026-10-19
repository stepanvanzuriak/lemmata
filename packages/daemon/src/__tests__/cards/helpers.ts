import { createProject, listCanvases, MIGRATIONS_FOLDER, openDb } from "core";
import type { RunContext } from "../../cards/types.js";

export async function canvasSetup(
  author: RunContext["author"] = {
    role: "assistant",
    agentId: "a1",
  },
) {
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  const project = await createProject(db, {
    title: "Collatz",
    statement: "Every orbit reaches 1.",
  });
  const [canvas] = await listCanvases(db, project.id);
  const run: RunContext = { canvasId: canvas!.id, author };

  return { db, project, canvas: canvas!, run };
}
