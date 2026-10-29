import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { ClaudeAdapter } from "../../../adapters/claude/adapter.js";
import { claudeArgs } from "../../../adapters/claude/args.js";
import type { RunEvent, RunHandle } from "../../../runner.js";

const fake = fileURLToPath(new URL("./fake-claude.mjs", import.meta.url));
const adapter = new ClaudeAdapter({ command: "node", commandArgs: [fake] });
const base = { cwd: process.cwd(), prompt: "hi" };

afterEach(() => {
  delete process.env.FAKE_CLAUDE;
});

async function collect(handle: RunHandle) {
  const events: RunEvent[] = [];
  for await (const event of handle.events) {
    events.push(event);
  }
  return events;
}

it("streams a successful run", async () => {
  const events = await collect(adapter.start(base));

  expect(events).toEqual([
    { type: "session", sessionId: "fake-session" },
    { type: "text", text: "OK" },
    {
      type: "usage",
      messageId: "msg_1",
      usage: { input: 10, output: 2, cacheRead: 0, cacheWrite: 0 },
    },
    { type: "done", reason: "completed" },
  ]);
});

it("turns a crash into an error with stderr", async () => {
  process.env.FAKE_CLAUDE = "crash";
  const events = await collect(adapter.start(base));
  const error = events.find((e) => e.type === "error");

  expect(error && "message" in error && error.message).toContain("boom");
  expect(events.at(-1)).toEqual({ type: "done", reason: "error" });
});

it("captures full provider envelopes and stderr only when requested", async () => {
  const events = await collect(
    adapter.start({ ...base, captureRawEvents: true }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "provider",
      stream: "stdout",
      data: expect.objectContaining({
        type: "assistant",
        message: expect.objectContaining({ content: expect.any(Array) }),
      }),
    }),
  );
  process.env.FAKE_CLAUDE = "crash";
  const failed = await collect(
    adapter.start({ ...base, captureRawEvents: true }),
  );
  expect(failed).toContainEqual(
    expect.objectContaining({
      type: "provider",
      stream: "stderr",
      data: expect.stringContaining("boom"),
    }),
  );
});

it("aborts a hanging run within a second", async () => {
  process.env.FAKE_CLAUDE = "hang";
  const handle = adapter.start(base);
  const started = Date.now();
  const events = collect(handle);

  await new Promise((resolve) => setTimeout(resolve, 200));
  await handle.abort();

  expect((await events).at(-1)).toEqual({ type: "done", reason: "aborted" });
  expect(Date.now() - started).toBeLessThan(1200);
});

it("builds the default flags", () => {
  const { args, env } = claudeArgs(base);

  expect(args).toEqual([
    "-p",
    "hi",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "default",
    "--allowedTools",
    "Read,Glob,Grep",
  ]);
  expect(env).toEqual({});
});

it("isolates MCP config and loads tools up front", async () => {
  const options = {
    ...base,
    mcpServers: { lemmata: { type: "http" as const, url: "http://x/mcp" } },
  };
  const { args, env } = claudeArgs(options);

  expect(args).toContain("--strict-mcp-config");
  expect(args[args.indexOf("--allowedTools") + 1]).toBe(
    "Read,Glob,Grep,mcp__lemmata",
  );
  expect(args[args.indexOf("--mcp-config") + 1]).toBe(
    JSON.stringify({ mcpServers: options.mcpServers }),
  );
  expect(args.slice(args.indexOf("--tools"))).toEqual([
    "--tools",
    "Read",
    "Glob",
    "Grep",
  ]);
  expect(env).toEqual({ ENABLE_TOOL_SEARCH: "false" });

  process.env.FAKE_CLAUDE = "crash";
  const events = await collect(adapter.start(options));
  const error = events.find((e) => e.type === "error");
  expect(error && "message" in error && error.message).toContain(
    "ENABLE_TOOL_SEARCH=false",
  );
});

it("limits the turns of a run", () => {
  const { args } = claudeArgs({ ...base, maxTurns: 30 });

  expect(args.slice(-2)).toEqual(["--max-turns", "30"]);
});
