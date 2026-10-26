import { createProject, listAttempts, MIGRATIONS_FOLDER, openDb } from "core";
import { expect, it } from "vitest";
import { runAttempt } from "../attempt.js";
import { FakeAdapter } from "../adapters/fake.js";
import { mapCodexLine } from "../adapters/codex/messages.js";
import type { RunEvent } from "../runner.js";

const usage = (messageId: string, input: number): RunEvent => ({
  type: "usage",
  messageId,
  usage: { input, output: 10, cacheRead: 5, cacheWrite: 0 },
});

async function setup(script: RunEvent[]) {
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  const project = await createProject(db, { title: "P" });
  const adapter = new FakeAdapter(script);
  const options = { cwd: "/tmp", prompt: "go" };

  return { db, project, adapter, options };
}

it("stores the session id and token totals", async () => {
  const { db, project, adapter, options } = await setup([
    { type: "session", sessionId: "s1" },
    usage("m1", 100),
    usage("m2", 50),
    { type: "done", reason: "completed" },
  ]);
  const events: RunEvent[] = [];

  const attempt = await runAttempt(
    { db, adapter, projectId: project.id, title: "t", options, maxTokens: 1e6 },
    (event) => {
      events.push(event);
    },
  );

  expect(attempt).toMatchObject({
    status: "done",
    sessionId: "s1",
    inputTokens: 150,
    outputTokens: 20,
    cacheReadTokens: 10,
  });
  expect(attempt.finishedAt).not.toBeNull();
  expect(events).toHaveLength(4);
  expect(adapter.starts).toEqual([options]);
  expect(await listAttempts(db, { projectId: project.id })).toHaveLength(1);
});

it("stops a run that passes its token budget", async () => {
  const { db, project, adapter, options } = await setup([
    usage("m1", 100),
    usage("m2", 100),
    usage("m3", 100),
    { type: "done", reason: "completed" },
  ]);

  const attempt = await runAttempt({
    db,
    adapter,
    projectId: project.id,
    title: "t",
    options,
    maxTokens: 150,
  });

  expect(attempt.status).toBe("stopped_budget");
  expect(attempt.inputTokens).toBe(200);
});

it("ends aborted when the signal fires", async () => {
  const { db, project, adapter, options } = await setup([
    { type: "session", sessionId: "s1" },
    usage("m1", 1),
    { type: "done", reason: "completed" },
  ]);
  const controller = new AbortController();
  controller.abort();

  const attempt = await runAttempt({
    db,
    adapter,
    projectId: project.id,
    title: "t",
    options,
    maxTokens: 1e6,
    signal: controller.signal,
  });

  expect(attempt.status).toBe("aborted");
});

it("keeps a completed Codex run done when its final usage exceeds the budget", async () => {
  const { db, project, adapter, options } = await setup([
    ...mapCodexLine({
      type: "turn.completed",
      usage: { input_tokens: 1_330_301, output_tokens: 6_287 },
    }),
  ]);

  const attempt = await runAttempt({
    db,
    adapter,
    projectId: project.id,
    title: "/reset",
    options,
    maxTokens: 1_000_000,
  });

  expect(attempt).toMatchObject({
    status: "done",
    inputTokens: 1_330_301,
    outputTokens: 6_287,
  });
});
