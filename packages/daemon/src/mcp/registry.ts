import { randomBytes } from "node:crypto";
import type { RunContext } from "../cards/types.js";

const runs = new Map<string, RunContext>();

/** Gives one agent run a secret for the MCP endpoint; it dies with `unregisterRun`. */
export function registerRun(run: RunContext): string {
  const secret = randomBytes(32).toString("hex");
  runs.set(secret, run);
  return secret;
}

export function unregisterRun(secret: string) {
  runs.delete(secret);
}

export function lookupRun(secret: string): RunContext | undefined {
  return runs.get(secret);
}

/** The `mcpServers` entry for an agent run (see `StartOptions` in `runner`). */
export function mcpConfigFor(secret: string, port: number) {
  return {
    lemmata: {
      type: "http" as const,
      url: `http://127.0.0.1:${port}/mcp`,
      headers: { Authorization: `Bearer ${secret}` },
    },
  };
}
