import type { CanvasAgent, ChatMessage } from "core/schema";
import type { CanvasEdge, CanvasNode } from "./canvas.js";

export type { CanvasAgent, ChatMessage };

export type ChatRequest = { text: string; model?: string | null };

export type ModelOption = { id: string; label: string };

export type AddAgentRequest = {
  role: CanvasAgent["role"];
  model?: string | null;
  tokenCap?: number | null;
};

export type RunRole =
  "assistant" | "literature" | "curator" | "reset" | CanvasAgent["role"];

export type RunInfo = {
  runKey: string;
  role: RunRole;
  model: string | null;
  target: string | null;
};

export type ChatEvent =
  | { type: "user"; message: ChatMessage; run: RunInfo }
  | { type: "text"; text: string }
  | { type: "tool_use"; name: string }
  | { type: "usage"; tokens: number }
  | { type: "cards"; nodes: CanvasNode[]; edges: CanvasEdge[] }
  | { type: "memory"; saved: number }
  | { type: "warning"; message: string }
  | { type: "error"; message: string }
  | { type: "done"; status: string; message: ChatMessage | null };

export type ChatConflict = {
  error: string;
  code: "busy" | "no_agent" | "no_target";
};
