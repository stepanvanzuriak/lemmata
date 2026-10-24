import type { AgentAdapter } from "../runner.js";
import { ClaudeAdapter } from "./claude/index.js";
import { CodexAdapter } from "./codex/index.js";

export const ADAPTERS = {
  claude: () => new ClaudeAdapter(),
  codex: () => new CodexAdapter(),
} satisfies Record<string, () => AgentAdapter>;

export type AdapterName = keyof typeof ADAPTERS;

export function createAdapter(name: AdapterName): AgentAdapter {
  return ADAPTERS[name]();
}
