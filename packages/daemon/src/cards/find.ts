import type { CanvasDetail, CanvasNode } from "shared";
import { fieldsOf, isArchived } from "./types.js";

export function findCard(
  detail: Pick<CanvasDetail, "nodes">,
  ref: string,
): CanvasNode | undefined {
  const wanted = ref.trim();

  const nodes = [
    ...detail.nodes.filter((n) => !isArchived(n)),
    ...detail.nodes.filter(isArchived),
  ];

  if (wanted.toLowerCase() === "goal") {
    return nodes.find((n) => n.kind === "goal");
  }

  return (
    nodes.find((n) => n.id === wanted) ??
    nodes.find(
      (n) =>
        (n.kind === "hypothesis" || n.kind === "attack") &&
        fieldsOf(n).label?.toLowerCase() === wanted.toLowerCase(),
    ) ??
    nodes.find((n) => fieldsOf(n).title === wanted)
  );
}
