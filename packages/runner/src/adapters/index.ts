import type { AgentAdapter } from "../runner.js";
import { ClaudeAdapter } from "./claude/index.js";

/** Adapters the daemon can start by name. Add new agents here. */
export const ADAPTERS = {
  claude: () => new ClaudeAdapter(),
} satisfies Record<string, () => AgentAdapter>;

export type AdapterName = keyof typeof ADAPTERS;

export function createAdapter(name: AdapterName): AgentAdapter {
  return ADAPTERS[name]();
}
