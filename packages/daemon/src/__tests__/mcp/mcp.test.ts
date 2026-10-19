import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AgentAdapter, RunEvent, StartOptions } from "runner";
import type { Canvas, Project } from "shared";
import { expect, it } from "vitest";
import {
  mcpConfigFor,
  registerRun,
  unregisterRun,
} from "../../mcp/registry.js";
import { authed, HOST, testApp } from "../helpers/app.js";
import { callTool, connectMcp, textOf, type App } from "../helpers/mcp.js";

async function setup() {
  const app = await testApp(
    undefined,
    await mkdtemp(join(tmpdir(), "lemmata-ws-")),
  );
  const json = { ...authed({ "content-type": "application/json" }) };
  const project = (await (
    await app.request("/api/projects", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ title: "Collatz", statement: "Orbits reach 1." }),
    })
  ).json()) as Project;
  const [canvas] = (await (
    await app.request(`/api/canvases?projectId=${project.id}`, {
      headers: authed(),
    })
  ).json()) as Canvas[];
  const secret = registerRun({
    canvasId: canvas!.id,
    author: { role: "assistant", agentId: "a1" },
  });

  return { app, canvas: canvas!, secret };
}

const connect = (app: App, options: StartOptions) =>
  connectMcp(() => app, options);
const call = callTool;

/** An agent that only knows its MCP config and runs a fixed tool script. */
class ScriptedTools implements AgentAdapter {
  readonly name = "scripted-tools";
  readonly models = [];

  constructor(
    private readonly app: App,
    private readonly script: (client: Client) => Promise<CallToolResult[]>,
  ) {}

  start(options: StartOptions) {
    const { app, script } = this;

    async function* events(): AsyncGenerator<RunEvent> {
      const client = await connect(app, options);
      for (const result of await script(client)) {
        yield result.isError
          ? { type: "error", message: textOf(result) }
          : { type: "text", text: textOf(result) };
      }
      yield { type: "done", reason: "completed" };
    }

    return { events: events(), abort: async () => {} };
  }
}

it("lists tools for a live secret", async () => {
  const { app, secret } = await setup();
  const client = await connect(app, {
    cwd: "/tmp",
    prompt: "",
    mcpServers: mcpConfigFor(secret, 4317),
  });
  const { tools } = await client.listTools();

  expect(client.getInstructions()).toContain("run_card");
  expect(tools.map((t) => t.name).sort()).toEqual([
    "connect_cards",
    "create_cards",
    "get_card",
    "read_canvas",
    "run_card",
    "update_card",
  ]);
});

it("answers 401 without a secret or after the run ends", async () => {
  const { app, secret } = await setup();
  const post = (auth?: string) =>
    app.request("/mcp", {
      method: "POST",
      headers: {
        host: HOST,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(auth && { authorization: `Bearer ${auth}` }),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });

  expect((await post()).status).toBe(401);
  unregisterRun(secret);
  expect((await post(secret)).status).toBe(401);
});

it("lets an agent create, run and settle a hypothesis, then nudges", async () => {
  const { app, secret } = await setup();
  const agent = new ScriptedTools(app, async (client) => [
    await call(client, "create_cards", {
      cards: [
        { kind: "hypothesis", title: "Small cases hold" },
        {
          kind: "python",
          title: "check small cases",
          source: "print(all(n > 0 for n in range(1, 10)))",
          connectFrom: "H1",
        },
      ],
    }),
    await call(client, "update_card", { id: "H1", status: "supported" }),
    await call(client, "run_card", { id: "check small cases" }),
    await call(client, "update_card", { id: "H1", status: "supported" }),
    await call(client, "read_canvas", {}),
  ]);
  const events: RunEvent[] = [];

  for await (const event of agent.start({
    cwd: "/tmp",
    prompt: "go",
    mcpServers: mcpConfigFor(secret, 4317),
  }).events) {
    events.push(event);
  }

  const [created, gated, ran, settled, canvas] = events;
  expect(created).toMatchObject({ type: "text" });
  expect(gated).toMatchObject({
    type: "error",
    message: expect.stringContaining("Run them with run_card first"),
  });
  expect(ran).toMatchObject({
    type: "text",
    text: expect.stringContaining("True"),
  });
  expect(settled).toMatchObject({
    type: "text",
    text: expect.stringContaining("Set the goal's status to proved"),
  });
  expect(canvas).toMatchObject({
    type: "text",
    text: expect.stringContaining("status: Supported"),
  });
});

it("returns invalid arguments as isError text", async () => {
  const { app, secret } = await setup();
  const client = await connect(app, {
    cwd: "/tmp",
    prompt: "",
    mcpServers: mcpConfigFor(secret, 4317),
  });

  const bad = await call(client, "create_cards", { cards: "nope" });
  const unknown = await call(client, "get_card", { id: "H9" });

  expect(bad.isError).toBe(true);
  expect(textOf(bad)).toMatch(/cards/);
  expect(unknown.isError).toBe(true);
  expect(textOf(unknown)).toContain('No card matches "H9"');
});
