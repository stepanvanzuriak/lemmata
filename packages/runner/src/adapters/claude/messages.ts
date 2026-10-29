import type { RunEvent } from "../../runner.js";

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const num = (value: unknown) => (typeof value === "number" ? value : 0);

function toolResultText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        isObject(part) && typeof part.text === "string" ? part.text : "",
      )
      .join("");
  }

  return "";
}

function assistantEvents(message: Json, seen: Set<string>): RunEvent[] {
  const events: RunEvent[] = [];
  const content = Array.isArray(message.content) ? message.content : [];

  for (const block of content) {
    if (!isObject(block)) {
      continue;
    }
    if (block.type === "text" && typeof block.text === "string") {
      events.push({ type: "text", text: block.text });
    }
    if (block.type === "tool_use") {
      events.push({
        type: "tool_use",
        id: String(block.id),
        name: String(block.name),
        input: block.input,
      });
    }
  }

  const id = typeof message.id === "string" ? message.id : null;

  if (id && isObject(message.usage) && !seen.has(id)) {
    seen.add(id);
    events.push({
      type: "usage",
      messageId: id,
      usage: {
        input: num(message.usage.input_tokens),
        output: num(message.usage.output_tokens),
        cacheRead: num(message.usage.cache_read_input_tokens),
        cacheWrite: num(message.usage.cache_creation_input_tokens),
      },
    });
  }

  return events;
}

function userEvents(message: Json): RunEvent[] {
  const content = Array.isArray(message.content) ? message.content : [];

  return content.filter(isObject).flatMap((block): RunEvent[] => {
    if (block.type !== "tool_result") {
      return [];
    }

    return [
      {
        type: "tool_result",
        id: String(block.tool_use_id),
        output: toolResultText(block.content),
        isError: block.is_error === true,
      },
    ];
  });
}

export function mapClaudeLine(json: unknown, seen: Set<string>): RunEvent[] {
  if (!isObject(json)) {
    return [];
  }

  switch (json.type) {
    case "system":
      if (json.subtype === "init" && typeof json.session_id === "string") {
        return [{ type: "session", sessionId: json.session_id }];
      }
      return [];
    case "assistant":
      return isObject(json.message) ? assistantEvents(json.message, seen) : [];
    case "user":
      return isObject(json.message) ? userEvents(json.message) : [];
    case "result":
      if (json.subtype === "success") {
        return [{ type: "done", reason: "completed" }];
      }
      if (json.subtype === "error_max_turns") {
        return [{ type: "done", reason: "budget" }];
      }
      return [
        { type: "error", message: String(json.result ?? json.subtype) },
        { type: "done", reason: "error" },
      ];
    default:
      return [];
  }
}
