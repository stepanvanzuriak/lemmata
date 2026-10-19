import type { CanvasDetail, CanvasNode } from "shared";
import { fieldsOf } from "./types.js";

/** `ref` is an id, `"goal"`, a hypothesis label such as `H2`, or an exact title. */
export function findCard(
  detail: Pick<CanvasDetail, "nodes">,
  ref: string,
): CanvasNode | undefined {
  const wanted = ref.trim();
  const { nodes } = detail;

  if (wanted.toLowerCase() === "goal") {
    return nodes.find((n) => n.kind === "goal");
  }

  return (
    nodes.find((n) => n.id === wanted) ??
    nodes.find(
      (n) =>
        n.kind === "hypothesis" &&
        fieldsOf(n).label?.toLowerCase() === wanted.toLowerCase(),
    ) ??
    nodes.find((n) => fieldsOf(n).title === wanted)
  );
}
