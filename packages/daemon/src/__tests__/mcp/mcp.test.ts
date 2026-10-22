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
import type { ArxivClient } from "../../arxiv/arxiv.js";
import { feedArxiv } from "../helpers/arxiv.js";
import { authed, HOST, testApp } from "../helpers/app.js";
import { STUB_PYPLOT } from "../helpers/matplotlib.js";
import { callTool, connectMcp, textOf, type App } from "../helpers/mcp.js";

async function setup(arxiv?: ArxivClient) {
  const app = await testApp(
    undefined,
    await mkdtemp(join(tmpdir(), "lemmata-ws-")),
    undefined,
    arxiv,
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
    "add_paper",
    "archive_cards",
    "connect_cards",
    "create_cards",
    "get_card",
    "read_canvas",
    "read_paper",
    "record_literature",
    "remember",
    "resolve_note",
    "run_card",
    "search_literature",
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
    text: expect.stringContaining(
      'update_card({ id: "goal", status: "proved" })',
    ),
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

it("returns figures from run_card as images, 3D ones from four angles", async () => {
  const { app, secret } = await setup();
  const client = await connect(app, {
    cwd: "/tmp",
    prompt: "",
    mcpServers: mcpConfigFor(secret, 4317),
  });

  await call(client, "create_cards", {
    cards: [
      {
        kind: "python",
        title: "plots",
        source: `${STUB_PYPLOT}\nplt._plot(1, title="Curve")\nplt._plot(2, "3d", "Saddle")`,
      },
    ],
  });
  const result = await call(client, "run_card", { id: "plots" });
  const [message, ...images] = result.content;

  expect(result.isError).toBeFalsy();
  expect(message).toMatchObject({ type: "text" });
  expect(textOf(result)).toContain('fig-1.png "Curve"');
  expect(textOf(result)).toContain(
    'fig-2.png "Saddle" (3D, 4 angles attached)',
  );
  expect(images).toHaveLength(2);
  expect(
    images.every((i) => i.type === "image" && i.mimeType === "image/png"),
  ).toBe(true);
  // the 3D figure's strip is a re-encoded PNG, unlike the stub's own bytes
  expect(images[1]).not.toEqual(images[0]);
});

const PAPER_TEX = [
  "\\documentclass{article}",
  "\\begin{document}",
  "\\section{Introduction}",
  "We study ordinary lines.",
  "\\section{Main result}",
  "\\begin{theorem}[Green--Tao]",
  "Few ordinary lines force a near-pencil.",
  "\\end{theorem}",
  "x".repeat(8_000),
  "\\end{document}",
].join("\n");

it("adds a paper and reads it by contents, section and query", async () => {
  const arxiv: ArxivClient = {
    ...feedArxiv,
    fetchSource: async () => ({
      file: { name: "main.tex", data: new TextEncoder().encode(PAPER_TEX) },
      files: ["main.tex"],
    }),
  };
  const { app, secret } = await setup(arxiv);
  const client = await connect(app, {
    cwd: "/tmp",
    prompt: "",
    mcpServers: mcpConfigFor(secret, 4317),
  });

  const added = await call(client, "add_paper", { id: "arXiv:1208.0053" });
  const id = /\[([^\]]+)\]/.exec(textOf(added))![1]!;

  const contents = textOf(await call(client, "read_paper", { card: id }));
  expect(contents).toContain("Abstract:");
  expect(contents).toContain("1. Main result");
  expect(contents).not.toContain("We study ordinary lines.");

  const section = textOf(
    await call(client, "read_paper", { card: id, section: "theorem" }),
  );
  expect(section).toContain("Few ordinary lines force");
  expect(section).toMatch(/\.\.\. \[\d+ more chars\]$/);

  const found = textOf(
    await call(client, "read_paper", { card: id, query: "ORDINARY lines" }),
  );
  expect(found).toContain("1 passage(s)");
  expect(found).toContain("near-pencil");
  expect(found).toContain("[0. Introduction]");

  const canvas = textOf(await call(client, "read_canvas", {}));
  expect(canvas).not.toContain("We study ordinary lines.");
});

it("refuses read_paper on a card that is not a paper", async () => {
  const { app, secret } = await setup();
  const client = await connect(app, {
    cwd: "/tmp",
    prompt: "",
    mcpServers: mcpConfigFor(secret, 4317),
  });
  const result = await call(client, "read_paper", { card: "goal" });

  expect(result.isError).toBe(true);
  expect(textOf(result)).toContain("not a paper");
});
