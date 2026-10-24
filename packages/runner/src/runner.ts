export type McpServer = {
  type: "http";
  url: string;
  headers?: Record<string, string>;
};

export type StartOptions = {
  cwd: string;
  prompt: string;
  resumeSessionId?: string;
  model?: { provider: string; id: string };
  permissions?: {
    mode: "default" | "plan" | "acceptEdits";
    allowedTools?: string[];
  };
  systemPromptAddendum?: string;
  /** Stops the run after this many model turns; each turn re-reads the whole context. */
  maxTurns?: number;
  mcpServers?: Record<string, McpServer>;
};

export type Usage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

export type DoneReason = "completed" | "aborted" | "budget" | "error";

export type RunEvent =
  | { type: "session"; sessionId: string }
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; output: string; isError: boolean }
  | { type: "usage"; messageId: string; usage: Usage }
  | { type: "error"; message: string }
  | { type: "done"; reason: DoneReason };

export type RunHandle = {
  events: AsyncIterable<RunEvent>;
  abort(): Promise<void>;
};

/** A model the user can pick; `id` is what the adapter passes to its agent. */
export type ModelOption = { id: string; label: string };

export type AgentAdapter = {
  name: string;
  /** Models offered in the UI; empty means the agent's own default only. */
  models: ModelOption[];
  start(options: StartOptions): RunHandle;
};
