import type { RunEvent } from "../../runner.js";

type Json = Record<string, unknown>;
const object = (x: unknown): x is Json =>
  typeof x === "object" && x !== null && !Array.isArray(x);

export function mapCodexLine(value: unknown): RunEvent[] {
  if (!object(value)) {
    return [];
  }
  const item = object(value.item) ? value.item : {};
  switch (value.type) {
    case "thread.started":
      return typeof value.thread_id === "string"
        ? [{ type: "session", sessionId: value.thread_id }]
        : [];
    case "item.completed":
    case "item.started":
      if (
        item.type === "agent_message" &&
        typeof item.text === "string" &&
        value.type === "item.completed"
      ) {
        return [{ type: "text", text: item.text }];
      }
      if (item.type === "mcp_tool_call") {
        const events: RunEvent[] = [
          {
            type: "tool_use",
            id: String(item.id ?? ""),
            name: String(item.tool ?? item.name ?? "MCP"),
            input: item.arguments ?? {},
          },
        ];
        if (value.type === "item.completed") {
          events.push({
            type: "tool_result",
            id: String(item.id ?? ""),
            output: String(item.result ?? item.error ?? ""),
            isError: item.status === "failed" || Boolean(item.error),
          });
        }
        return events;
      }
      if (item.type === "command_execution") {
        const events: RunEvent[] = [
          {
            type: "tool_use",
            id: String(item.id ?? ""),
            name: "command_execution",
            input: item.command ?? "",
          },
        ];
        if (value.type === "item.completed") {
          events.push({
            type: "tool_result",
            id: String(item.id ?? ""),
            output: String(item.aggregated_output ?? ""),
            isError: typeof item.exit_code === "number" && item.exit_code !== 0,
          });
        }
        return events;
      }
      return [];
    case "turn.completed": {
      const usage = object(value.usage) ? value.usage : {};
      const events: RunEvent[] = [];
      // Codex counts cached tokens inside input_tokens.
      const cached = Number(usage.cached_input_tokens ?? 0);
      if (
        typeof usage.input_tokens === "number" ||
        typeof usage.output_tokens === "number"
      ) {
        events.push({
          type: "usage",
          final: true,
          messageId: String(value.thread_id ?? Date.now()),
          usage: {
            input: Math.max(Number(usage.input_tokens ?? 0) - cached, 0),
            output: Number(usage.output_tokens ?? 0),
            cacheRead: cached,
            cacheWrite: 0,
          },
        });
      }
      events.push({ type: "done", reason: "completed" });
      return events;
    }
    case "turn.failed":
      return [
        {
          type: "error",
          message: object(value.error)
            ? String(value.error.message ?? "Codex run failed")
            : "Codex run failed",
        },
        { type: "done", reason: "error" },
      ];
    default:
      return [];
  }
}
