import type { CanvasNode } from "shared";

/** The prover request for one step of a card's progress. The id, not the label, names the card: labels can repeat after a reset. */
export const workOnStep = (node: CanvasNode, step: string) =>
  `/prover ${node.kind === "goal" ? "goal" : node.id} Work on this step from the progress record: ${step}\n\nFocus this run on it. Record what you establish, and what remains, with update_progress.`;
