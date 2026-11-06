import type { CanvasNode, CardProgress, Paper } from "shared";

export type AgentRole =
  "assistant" | "prover" | "referee" | "literature" | "curator" | "reset";

export type Author = { agentId?: string; role: AgentRole };

export type RunContext = {
  canvasId: string;
  author: Author;
  target?: string;
  focus?: string[];
  attemptId?: string;
  /** The chat message that started this run. */
  requestId?: string;
  memorySaved?: number;
  papers?: Map<string, Paper>;
};

export class ToolRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolRefusal";
  }
}

export type CardFields = {
  title?: string;
  tags?: string[];
  text?: string;
  markdown?: string;
  label?: string;
  status?: string;
  source?: string;
  python?: string;
  lean?: string;
  author?: string;
  agentId?: string;
  archived?: { at: string; by?: string; reason?: string } | null;
  resolved?: { at: string; by?: string; reason?: string } | null;
  settledAt?: string;
  progress?: CardProgress;
};

export const fieldsOf = (node: CanvasNode) => node.payload as CardFields;

export const isArchived = (node: CanvasNode) =>
  Boolean(fieldsOf(node).archived);

export const isResolved = (node: CanvasNode) =>
  node.kind === "note" && Boolean(fieldsOf(node).resolved);
