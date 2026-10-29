import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import type { DebugAttempt, DebugEventPage, Project, Canvas } from "shared";
import { authed, HOST, testApp } from "../helpers/app.js";
import {
  ScriptedAgent,
  callTool,
  textOf,
  type App,
  type Step,
} from "../helpers/mcp.js";

const json = (body: unknown) => ({
  method: "POST",
  headers: authed({ "content-type": "application/json" }),
  body: JSON.stringify(body),
});

async function setup(devMode: boolean, step: Step) {
  const holder = {} as { app: App };
  const agent = new ScriptedAgent(() => holder.app, step);
  holder.app = await testApp(
    undefined,
    await mkdtemp(join(tmpdir(), "lemmata-debug-")),
    () => agent,
    undefined,
    devMode,
  );
  const { app } = holder;
  const project = (await (
    await app.request("/api/projects", json({ title: "P", statement: "Goal" }))
  ).json()) as Project;
  const [canvas] = (await (
    await app.request(`/api/canvases?projectId=${project.id}`, {
      headers: authed(),
    })
  ).json()) as Canvas[];
  const base = `/api/debug/canvases/${canvas!.id}/attempts`;
  const chat = async (text: string) => {
    const response = await app.request(
      `/api/canvases/${canvas!.id}/chat`,
      json({ text }),
    );
    expect(response.status).toBe(200);
    return response.text();
  };
  return { app, base, chat, agent, canvas: canvas! };
}

it("records task prompts, messages and full MCP calls/results with ordered, canvas-scoped pages", async () => {
  const long = "a".repeat(12_000);
  const { app, base, chat, agent, canvas } = await setup(
    true,
    async (client) => {
      const result = await callTool(client, "create_cards", {
        cards: [{ kind: "statement", title: "Lemma", markdown: long }],
      });
      const bad = await callTool(client, "get_card", { id: "absent" });
      expect(bad.isError).toBe(true);
      return [
        { type: "text", text: "Full answer" },
        {
          type: "tool_use",
          id: "tool1",
          name: "create_cards",
          input: { body: long },
        },
        {
          type: "tool_result",
          id: "tool1",
          output: textOf(result),
          isError: false,
        },
      ];
    },
  );
  await app.request(
    `/api/canvases/${canvas.id}/agents`,
    json({ role: "prover" }),
  );
  await chat("/prover goal");
  expect(agent.starts[0]!.captureRawEvents).toBe(true);
  const attempts = (await (
    await app.request(base, { headers: authed() })
  ).json()) as DebugAttempt[];
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({ title: "/prover goal", status: "done" });
  const endpoint = `${base}/${attempts[0]!.id}/events`;
  const page = (await (
    await app.request(`${endpoint}?limit=2`, { headers: authed() })
  ).json()) as DebugEventPage;
  expect(page.events).toHaveLength(2);
  expect(page.nextCursor).toBe(page.events.at(-1)!.id);
  expect(page.events[0]).toMatchObject({
    kind: "run.start",
    data: {
      request: "/prover goal",
      role: "prover",
      prompt: agent.starts[0]!.prompt,
      systemPromptAddendum: agent.starts[0]!.systemPromptAddendum,
    },
  });
  expect(JSON.stringify(page.events[0])).not.toContain("Authorization");
  const next = (await (
    await app.request(`${endpoint}?after=${page.nextCursor}&limit=500`, {
      headers: authed(),
    })
  ).json()) as DebugEventPage;
  const events = [...page.events, ...next.events];
  expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  expect(next.nextCursor).toBeNull();
  expect(events).toContainEqual(
    expect.objectContaining({
      kind: "mcp.request",
      data: expect.objectContaining({
        method: "tools/call",
        params: {
          name: "create_cards",
          arguments: {
            cards: [{ kind: "statement", title: "Lemma", markdown: long }],
          },
        },
      }),
    }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      kind: "mcp.response",
      data: expect.objectContaining({
        body: expect.objectContaining({
          result: expect.objectContaining({ isError: true }),
        }),
      }),
    }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      kind: "agent.text",
      data: { type: "text", text: "Full answer" },
    }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      kind: "agent.tool_use",
      data: expect.objectContaining({ input: { body: long } }),
    }),
  );
  expect(events.at(-1)).toMatchObject({
    kind: "run.finish",
    data: { status: "done" },
  });
  expect(
    (await app.request(endpoint, { headers: { host: HOST } })).status,
  ).toBe(401);
  expect(
    (await app.request(`${endpoint}?after=-1`, { headers: authed() })).status,
  ).toBe(400);
  expect(
    (
      await app.request(
        `/api/debug/canvases/other/attempts/${attempts[0]!.id}/events`,
        { headers: authed() },
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await app.request("/api/debug/canvases/absent/attempts", {
        headers: authed(),
      })
    ).status,
  ).toBe(404);
});

it("exposes no debug endpoints or recording outside development", async () => {
  const { app, base, chat, agent } = await setup(false, async () => [
    { type: "text", text: "Done" },
  ]);
  await chat("hello");
  expect(agent.starts[0]!.captureRawEvents).toBeUndefined();
  expect((await app.request(base, { headers: authed() })).status).toBe(404);
  expect(
    (await app.request(`${base}/any/events`, { headers: authed() })).status,
  ).toBe(404);
});
