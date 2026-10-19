import type { CanvasAgent, ChatMessage } from "core/schema";
import type { CanvasEdge, CanvasNode } from "./canvas.js";

export type { CanvasAgent, ChatMessage };

/** `model` applies to Assistant messages; agents use their own model. */
export type ChatRequest = { text: string; model?: string | null };

export type ModelOption = { id: string; label: string };

export type AddAgentRequest = {
  role: CanvasAgent["role"];
  model?: string | null;
  tokenCap?: number | null;
};

export type RunInfo = {
  runKey: string;
  role: "assistant" | CanvasAgent["role"];
  model: string | null;
  target: string | null;
};

export type ChatEvent =
  | { type: "user"; message: ChatMessage; run: RunInfo }
  | { type: "text"; text: string }
  | { type: "tool_use"; name: string }
  | { type: "usage"; tokens: number }
  | { type: "cards"; nodes: CanvasNode[]; edges: CanvasEdge[] }
  | { type: "warning"; message: string }
  | { type: "error"; message: string }
  | { type: "done"; status: string; message: ChatMessage | null };

export type ChatConflict = {
  error: string;
  code: "busy" | "no_agent" | "no_target";
};
