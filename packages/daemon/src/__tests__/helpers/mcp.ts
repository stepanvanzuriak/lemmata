import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AgentAdapter, RunEvent, StartOptions } from "runner";
import type { ChatEvent } from "shared";
import { HOST, type testApp } from "./app.js";

export type App = Awaited<ReturnType<typeof testApp>>;

export const appFetch =
  (app: () => App): typeof fetch =>
  async (url, init) => {
    const headers = new Headers(init?.headers);
    headers.set("host", HOST);
    return app().request(String(url), { ...init, headers });
  };

export async function connectMcp(app: () => App, options: StartOptions) {
  const { url, headers } = options.mcpServers!.lemmata!;
  const client = new Client({ name: "test-agent", version: "0" });

  await client.connect(
    new StreamableHTTPClientTransport(new URL(url), {
      requestInit: { headers },
      fetch: appFetch(app),
    }),
  );
  return client;
}

export const textOf = (result: unknown) =>
  (result as CallToolResult).content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n");

export const callTool = (
  client: Client,
  name: string,
  args: Record<string, unknown>,
) => client.callTool({ name, arguments: args }) as Promise<CallToolResult>;

export type Step = (
  client: Client,
  options: StartOptions,
) => Promise<RunEvent[]>;

/**
 * An agent that knows only its start options: it reports a session (resumed or new),
 * runs scripted MCP tool calls and replies. `app` is a getter because the app is built
 * with this adapter.
 */
export class ScriptedAgent implements AgentAdapter {
  readonly name = "scripted";
  readonly models = [{ id: "fast", label: "Fast" }];
  readonly starts: StartOptions[] = [];
  private sessions = 0;

  constructor(
    private readonly app: () => App,
    private readonly step: Step,
  ) {}

  start(options: StartOptions) {
    this.starts.push(options);
    const sessionId = options.resumeSessionId ?? `session-${++this.sessions}`;
    const { app, step } = this;
    let aborted = false;

    async function* events(): AsyncGenerator<RunEvent> {
      yield { type: "session", sessionId };
      const client = await connectMcp(app, options);
      for (const event of await step(client, options)) {
        if (aborted) {
          break;
        }
        yield event;
      }
      yield { type: "done", reason: aborted ? "aborted" : "completed" };
    }

    return {
      events: events(),
      abort: async () => {
        aborted = true;
      },
    };
  }
}

/** Parses a finished SSE body into chat events. */
export function parseSse(body: string): ChatEvent[] {
  return body
    .split("\n\n")
    .map((frame) =>
      frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n"),
    )
    .filter(Boolean)
    .map((data) => JSON.parse(data) as ChatEvent);
}
