import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { ADAPTERS, ClaudeAdapter, CodexAdapter, FakeAdapter } from "runner";
import type { Canvas, Project } from "shared";
import { authed, testApp } from "../helpers/app.js";
import { parseSse } from "../helpers/mcp.js";

const json = (method: string, body?: unknown) => ({
  method,
  headers: authed({ "content-type": "application/json" }),
  body: body === undefined ? undefined : JSON.stringify(body),
});

afterEach(() => vi.restoreAllMocks());

async function setup() {
  const claude = new FakeAdapter([
    { type: "session", sessionId: "claude-session" },
    { type: "done", reason: "completed" },
  ]);
  const codex = new FakeAdapter([
    { type: "session", sessionId: "codex-session" },
    { type: "done", reason: "completed" },
  ]);
  vi.spyOn(ADAPTERS, "claude").mockImplementation(() =>
    Object.assign(new ClaudeAdapter(), { start: claude.start.bind(claude) }),
  );
  vi.spyOn(ADAPTERS, "codex").mockImplementation(() => {
    const adapter = new CodexAdapter();
    vi.spyOn(adapter, "models", "get").mockReturnValue(
      Promise.resolve([{ id: "gpt-test", label: "GPT Test" }]),
    );
    adapter.start = codex.start.bind(codex);
    return adapter;
  });
  const app = await testApp(
    undefined,
    await mkdtemp(join(tmpdir(), "lemmata-providers-")),
  );
  await app.request(
    "/api/settings",
    json("PATCH", { providers: { claude: true, codex: true } }),
  );
  const project = (await (
    await app.request("/api/projects", json("POST", { title: "P" }))
  ).json()) as Project;
  const [canvas] = (await (
    await app.request(`/api/canvases?projectId=${project.id}`, json("GET"))
  ).json()) as Canvas[];
  const base = `/api/canvases/${canvas!.id}`;
  const chat = async (text: string, model?: string) => {
    const response = await app.request(
      `${base}/chat`,
      json("POST", { text, model }),
    );
    expect(response.status).toBe(200);
    const events = parseSse(await response.text());
    expect(events.some((event) => event.type === "error")).toBe(false);
  };
  return { app, base, claude, codex, chat };
}

it("offers models from both enabled providers and routes roles independently", async () => {
  const { app, base, claude, codex, chat } = await setup();
  const models = await (await app.request("/api/models", json("GET"))).json();
  expect(models).toContainEqual({
    id: "claude:sonnet",
    label: "Claude Code · Sonnet 5.5",
  });
  expect(models).toContainEqual({
    id: "codex:gpt-test",
    label: "Codex · GPT Test",
  });
  await app.request(
    `${base}/agents`,
    json("POST", { role: "prover", model: "codex:gpt-test" }),
  );
  await app.request(
    `${base}/agents`,
    json("POST", { role: "referee", model: "claude:sonnet" }),
  );
  await chat("/prover goal", "claude:opus");
  await chat("/referee goal", "codex:gpt-test");
  expect(codex.starts[0]!.model).toEqual({ provider: "codex", id: "gpt-test" });
  expect(claude.starts[0]!.model).toEqual({ provider: "claude", id: "sonnet" });
});

it("hides disabled providers and rejects their saved models before starting runs", async () => {
  const { app, base, codex } = await setup();
  await app.request(
    "/api/settings",
    json("PATCH", { providers: { claude: true, codex: false } }),
  );
  const models = (await (
    await app.request("/api/models", json("GET"))
  ).json()) as { id: string }[];
  expect(models.every((model) => model.id.startsWith("claude:"))).toBe(true);
  const response = await app.request(
    `${base}/chat`,
    json("POST", { text: "hello", model: "codex:gpt-test" }),
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "no_provider" });
  expect(codex.starts).toHaveLength(0);
  expect(await (await app.request(`${base}/runs`, json("GET"))).json()).toEqual(
    [],
  );
});

it("keeps assistant sessions separate when switching providers", async () => {
  const { claude, codex, chat } = await setup();
  await chat("one", "claude:sonnet");
  await chat("two", "codex:gpt-test");
  await chat("three", "claude:sonnet");
  expect(codex.starts[0]!.resumeSessionId).toBeUndefined();
  expect(claude.starts[1]!.resumeSessionId).toBe("claude-session");
});

it("keeps a role's default independent of the chat model", async () => {
  const { app, base, claude, codex, chat } = await setup();
  await app.request(`${base}/agents`, json("POST", { role: "referee" }));
  await chat("/referee goal", "codex:gpt-test");
  expect(claude.starts[0]!.model).toBeUndefined();
  expect(codex.starts).toHaveLength(0);
});

it("allows provider defaults and reports when every provider is off", async () => {
  const { app, base, codex, chat } = await setup();
  await chat("hello", "codex:");
  expect(codex.starts[0]!.model).toBeUndefined();
  await app.request(
    "/api/settings",
    json("PATCH", { providers: { claude: false, codex: false } }),
  );
  const response = await app.request(
    `${base}/chat`,
    json("POST", { text: "hello" }),
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "no_provider" });
});
