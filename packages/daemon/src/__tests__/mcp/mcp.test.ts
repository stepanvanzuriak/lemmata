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
    "delete_toolbox",
    "get_canvas_index",
    "get_card",
    "get_toolbox_function",
    "get_toolbox_index",
    "read_canvas",
    "read_paper",
    "record_literature",
    "remember",
    "resolve_note",
    "run_card",
    "search_cards",
    "search_lean",
    "search_literature",
    "search_python",
    "update_card",
  ]);
});

it("indexes all canvas cards by type and reports LaTeX errors to agents", async () => {
  const { app, secret } = await setup();
  const client = await connect(app, {
    cwd: "/tmp",
    prompt: "",
    mcpServers: mcpConfigFor(secret, 4317),
  });
  const broken = await call(client, "create_cards", {
    cards: [{ kind: "statement", title: "Broken", text: "$\\frac{1}{$" }],
  });
  expect(broken.isError).toBe(true);
  expect(textOf(broken)).toContain("Invalid LaTeX in text");
  expect(textOf(broken)).toContain("retry the call");

  // More than search_cards' maximum page size, all returned in one index.
  for (let start = 0; start < 55; start += 8) {
    const result = await call(client, "create_cards", {
      cards: Array.from({ length: Math.min(8, 55 - start) }, (_, i) => ({
        kind: "note",
        title: `Note ${start + i}`,
        markdown: "Private body",
      })),
    });
    expect(result.isError).toBeFalsy();
  }
  await call(client, "create_cards", {
    cards: [{ kind: "hypothesis", title: "Claim", text: "$x^2$" }],
  });
  const archived = await call(client, "archive_cards", {
    ids: ["Note 0"],
    reason: "superseded",
  });
  expect(archived.isError).toBeFalsy();
  expect(textOf(archived)).toContain("Archived 1 card");
  const index = async (args: Record<string, unknown> = {}) => {
    const result = await call(client, "get_canvas_index", args);
    expect(result.isError).toBeFalsy();
    return JSON.parse(textOf(result));
  };
  const notes = await index({ kind: "note" });
  expect(notes.total).toBe(54);
  expect(notes.cards).toHaveLength(54);
  expect(JSON.stringify(notes)).not.toContain("Private body");
  expect(await index({ kind: "lean" })).toEqual({ total: 0, cards: [] });
  const hypotheses = await index({ kind: "hypothesis" });
  expect(hypotheses.cards).toEqual([
    expect.objectContaining({
      kind: "hypothesis",
      title: "Claim",
      label: "H1",
      status: "open",
    }),
  ]);
  expect((await index()).total).toBe(56);
  const allNotes = await index({ kind: "note", includeArchived: true });
  expect(allNotes.total).toBe(55);
  expect(
    allNotes.cards.find((card: { archived?: boolean }) => card.archived),
  ).toMatchObject({ title: "Note 0" });
  expect(
    (await call(client, "get_canvas_index", { kind: "banana" })).isError,
  ).toBe(true);

  await app.request("/api/projects", {
    method: "POST",
    headers: authed({ "content-type": "application/json" }),
    body: JSON.stringify({ title: "Other canvas", statement: "Other goal" }),
  });
  expect((await index()).total).toBe(56);
});

it("indexes and retrieves toolbox declarations without reading all source", async () => {
  const { app, secret } = await setup();
  const client = await connect(app, {
    cwd: "/tmp",
    prompt: "",
    mcpServers: mcpConfigFor(secret, 4317),
  });
  expect((await call(client, "get_toolbox_index", {})).isError).toBe(true);
  await call(client, "create_cards", {
    cards: [
      {
        kind: "toolbox",
        title: "Toolbox",
        python:
          "def double(n):\n    return 2 * n\n\ndef other():\n    return 0",
        lean: "def double (n : Nat) := n + n",
      },
    ],
  });
  const index = JSON.parse(
    textOf(await call(client, "get_toolbox_index", { limit: 1 })),
  );
  expect(index.total).toBe(3);
  expect(index.nextOffset).toBe(1);
  expect(index.entries[0]).toMatchObject({
    name: "double",
    language: "python",
  });
  expect(index.entries[0]).not.toHaveProperty("source");
  const filtered = JSON.parse(
    textOf(
      await call(client, "get_toolbox_index", {
        language: "lean",
        query: "double",
      }),
    ),
  );
  expect(filtered.total).toBe(1);
  expect(
    (await call(client, "get_toolbox_function", { name: "double" })).isError,
  ).toBe(true);
  const definition = JSON.parse(
    textOf(
      await call(client, "get_toolbox_function", {
        name: "double",
        language: "python",
      }),
    ),
  );
  expect(definition.toolboxId).toBe(index.toolboxId);
  expect(definition.source).toBe("def double(n):\n    return 2 * n");
  expect(
    (await call(client, "get_toolbox_function", { name: "absent" })).isError,
  ).toBe(true);
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

it("searches cards with compact pages, content matches and archive filtering", async () => {
  const { app, secret } = await setup();
  const client = await connect(app, {
    cwd: "/tmp",
    prompt: "",
    mcpServers: mcpConfigFor(secret, 4317),
  });
  const long = "x".repeat(10_000);
  const created = await call(client, "create_cards", {
    cards: [
      {
        kind: "hypothesis",
        title: "Parity route",
        markdown: `${long} HiddenLemma ${long}`,
      },
      {
        kind: "python",
        title: "Parity check",
        source: `${long} modular_check ${long}`,
      },
      { kind: "note", title: "Old parity route", text: "Archived detail" },
    ],
  });
  expect(created.isError).toBeFalsy();
  const archived = await call(client, "archive_cards", {
    ids: ["Old parity route"],
    reason: "superseded",
  });
  expect(archived.isError).toBeFalsy();

  const search = async (args: Record<string, unknown> = {}) => {
    const result = await call(client, "search_cards", args);
    expect(result.isError).toBeFalsy();
    return JSON.parse(textOf(result));
  };
  const index = await search();
  expect(index.total).toBe(3);
  expect(index.nextOffset).toBeNull();
  expect(
    index.cards.find((card: { label?: string }) => card.label === "H1"),
  ).toMatchObject({
    title: "Parity route",
    kind: "hypothesis",
    status: "open",
  });
  expect(JSON.stringify(index)).not.toContain("HiddenLemma");
  expect(JSON.stringify(index).length).toBeLessThan(1_000);

  const first = await search({ query: "  PARITY  ", limit: 1 });
  expect(first.total).toBe(2);
  expect(first.cards).toHaveLength(1);
  expect(first.nextOffset).toBe(1);
  const second = await search({
    query: "parity",
    limit: 1,
    offset: first.nextOffset,
  });
  expect(second.cards).toHaveLength(1);
  expect(second.cards[0].id).not.toBe(first.cards[0].id);
  expect(second.nextOffset).toBeNull();
  expect((await search({ query: "H1" })).cards[0].label).toBe("H1");
  expect((await search({ query: first.cards[0].id })).cards[0].id).toBe(
    first.cards[0].id,
  );

  const body = await search({ query: "hiddenlemma" });
  expect(body.cards).toHaveLength(1);
  expect(body.cards[0].snippet).toContain("HiddenLemma");
  expect(body.cards[0].snippet.length).toBeLessThan(220);
  const code = await search({ query: "MODULAR_CHECK", kind: "python" });
  expect(code.cards[0].snippet).toContain("modular_check");
  expect((await search({ query: "modular_check", kind: "note" })).total).toBe(
    0,
  );
  expect(await search({ query: "no such card" })).toEqual({
    total: 0,
    cards: [],
    nextOffset: null,
  });
  expect((await search({ offset: 100 })).cards).toEqual([]);
  const all = await search({ query: "parity", includeArchived: true });
  expect(all.total).toBe(3);
  expect(
    all.cards.find((card: { archived?: boolean }) => card.archived),
  ).toMatchObject({ title: "Old parity route", archived: true });

  // Other canvases must not appear in the run's search.
  await app.request("/api/projects", {
    method: "POST",
    headers: authed({ "content-type": "application/json" }),
    body: JSON.stringify({
      title: "Other parity project",
      statement: "HiddenLemma",
    }),
  });
  expect((await search()).total).toBe(3);
  const full = await call(client, "get_card", { id: body.cards[0].id });
  expect(textOf(full)).toContain(`${long} HiddenLemma ${long}`);
  for (const args of [{ limit: 51 }, { limit: 0 }, { offset: -1 }]) {
    expect((await call(client, "search_cards", args)).isError).toBe(true);
  }
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
