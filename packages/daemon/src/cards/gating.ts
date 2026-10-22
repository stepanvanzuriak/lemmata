import { cardStatus, type CanvasDetail, type CanvasNode } from "shared";

const CHECK_EDGES = new Set(["tested-by", "checked-by"]);
const CHECK_KINDS = new Set(["python", "lean"]);

export function unpassedChecks(
  detail: CanvasDetail,
  card: CanvasNode,
): CanvasNode[] {
  const byId = new Map(detail.nodes.map((n) => [n.id, n]));
  const linked = detail.edges
    .filter((e) => CHECK_EDGES.has(e.kind))
    .flatMap((e) => {
      if (e.fromNode === card.id) {
        return [byId.get(e.toNode)];
      }
      if (e.toNode === card.id) {
        return [byId.get(e.fromNode)];
      }
      return [];
    })
    .filter((n): n is CanvasNode => Boolean(n && CHECK_KINDS.has(n.kind)));

  return linked.filter((n) => cardStatus(n, detail)?.tone !== "ok");
}
