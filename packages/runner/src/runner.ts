export type McpServer = {
  type: "http";
  url: string;
  headers?: Record<string, string>;
};

export type StartOptions = {
  captureRawEvents?: boolean;
  cwd: string;
  prompt: string;
  resumeSessionId?: string;
  model?: { provider: string; id: string };
  permissions?: {
    mode: "default" | "plan" | "acceptEdits";
    allowedTools?: string[];
  };
  systemPromptAddendum?: string;
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
  | { type: "provider"; stream: "stdout" | "stderr"; data: unknown }
  | { type: "session"; sessionId: string }
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; output: string; isError: boolean }
  | {
      type: "usage";
      messageId: string;
      usage: Usage;
      /** Retrospective totals for a completed run; there is no work left to stop. */
      final?: boolean;
    }
  | { type: "error"; message: string }
  | { type: "done"; reason: DoneReason };

export type RunHandle = {
  events: AsyncIterable<RunEvent>;
  abort(): Promise<void>;
};

export type ModelOption = { id: string; label: string };

export type AgentAdapter = {
  name: string;
  models: ModelOption[] | Promise<ModelOption[]>;
  start(options: StartOptions): RunHandle;
};
