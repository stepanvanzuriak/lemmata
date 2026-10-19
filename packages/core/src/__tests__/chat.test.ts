import { expect, it } from "vitest";
import {
  addAgent,
  addMessage,
  addNode,
  clearClaims,
  createProject,
  finishAttempt,
  getCanvas,
  listAgents,
  listCanvases,
  listMessages,
  lastSessionId,
  MIGRATIONS_FOLDER,
  openDb,
  parsePayload,
  setAttemptSession,
  startAttempt,
} from "../index.js";
import { canvas } from "../db/schema.js";
import { eq } from "drizzle-orm";

async function setup() {
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  const project = await createProject(db, { title: "P" });
  const [c] = await listCanvases(db, project.id);
  return { db, project, canvasId: c!.id };
}

async function reply(
  db: Awaited<ReturnType<typeof setup>>["db"],
  projectId: string,
  canvasId: string,
  sessionId: string,
  agentId: string | null,
  target: string | null,
) {
  const attempt = await startAttempt(db, { projectId, canvasId, title: "t" });
  await setAttemptSession(db, attempt.id, sessionId);
  await finishAttempt(db, attempt.id, "done");
  await addMessage(db, {
    canvasId,
    role: "assistant",
    text: "ok",
    attemptId: attempt.id,
    agentId,
    target,
  });
}

it("allows one agent per role on a canvas", async () => {
  const { db, canvasId } = await setup();
  await addAgent(db, { canvasId, role: "prover" });

  await expect(addAgent(db, { canvasId, role: "prover" })).rejects.toThrow();
  await addAgent(db, { canvasId, role: "referee" });
  expect(await listAgents(db, canvasId)).toHaveLength(2);
});

it("keeps sessions separate per agent and target", async () => {
  const { db, project, canvasId } = await setup();
  const prover = await addAgent(db, { canvasId, role: "prover" });

  await reply(db, project.id, canvasId, "s-h1", prover.id, "h1");
  await reply(db, project.id, canvasId, "s-h2", prover.id, "h2");
  await reply(db, project.id, canvasId, "s-chat", null, null);

  expect(await lastSessionId(db, canvasId, prover.id, "h1")).toBe("s-h1");
  expect(await lastSessionId(db, canvasId, prover.id, "h2")).toBe("s-h2");
  expect(await lastSessionId(db, canvasId, null, null)).toBe("s-chat");
  expect(await lastSessionId(db, canvasId, prover.id, "h3")).toBeNull();
});

it("removes agents and messages with their canvas", async () => {
  const { db, canvasId } = await setup();
  await addAgent(db, { canvasId, role: "prover" });
  await addMessage(db, { canvasId, role: "user", text: "hi" });

  await db.delete(canvas).where(eq(canvas.id, canvasId));

  expect(await listAgents(db, canvasId)).toEqual([]);
  expect(await listMessages(db, canvasId)).toEqual([]);
});

it("clears claims and reopens claimed hypotheses", async () => {
  const { db, canvasId } = await setup();
  const claimed = await addNode(db, {
    canvasId,
    kind: "hypothesis",
    payload: {
      title: "H",
      status: "claimed",
      claimedBy: "a",
      claimedByRole: "prover",
    },
  });
  const supported = await addNode(db, {
    canvasId,
    kind: "hypothesis",
    payload: { title: "S", status: "supported", claimedBy: "a" },
  });

  expect(await clearClaims(db)).toBe(2);

  const nodes = (await getCanvas(db, canvasId))!.nodes;
  const payload = (id: string) =>
    parsePayload(nodes.find((n) => n.id === id)!.payload);
  expect(payload(claimed.id)).toEqual({ title: "H", status: "open" });
  expect(payload(supported.id)).toEqual({ title: "S", status: "supported" });
});
