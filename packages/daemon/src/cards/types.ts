import type { CanvasNode, Paper } from "shared";

/** Prover and referee are agents on the canvas; literature, curator and reset are one-off tasks (`/literature`, `/tidy`, `/reset`). */
export type AgentRole =
  "assistant" | "prover" | "referee" | "literature" | "curator" | "reset";

export type Author = { agentId?: string; role: AgentRole };

export type RunContext = {
  canvasId: string;
  author: Author;
  target?: string;
  focus?: string[];
  attemptId?: string;
  memorySaved?: number;
  /** Papers returned by search_literature in this run, so record_literature needs no second request. */
  papers?: Map<string, Paper>;
};

/** A refusal the model should read and act on (wrong ref, no right, gating, ...). */
export class ToolRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolRefusal";
  }
}

export type CardFields = {
  title?: string;
  text?: string;
  markdown?: string;
  label?: string;
  status?: string;
  source?: string;
  author?: string;
  agentId?: string;
  archived?: { at: string; by?: string; reason?: string } | null;
};

export const fieldsOf = (node: CanvasNode) => node.payload as CardFields;

export const isArchived = (node: CanvasNode) =>
  Boolean(fieldsOf(node).archived);
