import type { CanvasNode } from "shared";

export type AgentRole = "assistant" | "prover" | "referee";

export type Author = { agentId?: string; role: AgentRole };

/** One agent run's view of the canvas: who is acting and where. */
export type RunContext = {
  canvasId: string;
  author: Author;
  target?: string;
  focus?: string[];
};

/** A refusal the model should read and act on (wrong ref, no right, gating, …). */
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
};

export const fieldsOf = (node: CanvasNode) => node.payload as CardFields;
