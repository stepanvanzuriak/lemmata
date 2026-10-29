import type { CanvasNode } from "shared";
import { fieldsOf, type Author } from "./types.js";

export type EditRight = "all" | "body" | "status" | "none";

export function editRight(card: CanvasNode, author: Author): EditRight {
  if (card.kind === "toolbox") {
    return "all";
  }
  if (author.agentId && fieldsOf(card).agentId === author.agentId) {
    return "all";
  }
  if (author.role === "assistant" && card.createdBy === "ai") {
    return "all";
  }
  if (author.role === "literature" && card.kind === "literature") {
    return "all";
  }
  if (
    (author.role === "curator" || author.role === "reset") &&
    card.createdBy === "ai" &&
    card.kind !== "goal" &&
    card.kind !== "hypothesis"
  ) {
    return "all";
  }
  if (
    author.role === "prover" &&
    (card.kind === "hypothesis" || card.kind === "attack")
  ) {
    return "body";
  }
  if (author.role === "prover" && card.kind === "goal") {
    return "status";
  }

  return "none";
}
