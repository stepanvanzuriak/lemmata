import type { CardFlowNode } from "./cards/CardNode";
import type { CardFlowEdge } from "./edges";

/** Project the graph for display only; hidden cards keep their data and positions. */
export function collapseCards(
  nodes: CardFlowNode[],
  edges: CardFlowEdge[],
  collapsed: ReadonlySet<string>,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map<string, string[]>();
  for (const { source, target } of edges) {
    if (!byId.has(source) || !byId.has(target)) {
      continue;
    }
    const list = children.get(source) ?? [];
    list.push(target);
    children.set(source, list);
  }

  const descendants = (id: string) => {
    const seen = new Set([id]);
    const pending = [...(children.get(id) ?? [])];
    while (pending.length) {
      const next = pending.pop()!;
      if (seen.has(next)) {
        continue;
      }
      seen.add(next);
      pending.push(...(children.get(next) ?? []));
    }
    seen.delete(id);
    return seen;
  };

  const hidden = new Set<string>();
  const groups = new Map<string, Set<string>>();
  for (const node of nodes) {
    if (!collapsed.has(node.id) || hidden.has(node.id)) {
      continue;
    }
    const group = descendants(node.id);
    for (const id of groups.keys()) {
      if (group.has(id)) {
        groups.delete(id);
      }
    }
    groups.set(node.id, group);
    for (const id of group) {
      hidden.add(id);
    }
  }

  return {
    nodes: nodes
      .filter(({ id }) => !hidden.has(id))
      .map((node) => {
        const group = groups.get(node.id);
        const descendantCount =
          group?.size ?? new Set(children.get(node.id)).size;
        if (!descendantCount) {
          return node;
        }
        const activity = group
          ? [node, ...[...group].map((id) => byId.get(id)!)].flatMap(
              ({ data }) => (data.status?.tone === "work" ? [data.status] : []),
            )
          : [];
        const status = activity.length
          ? {
              tone: "work" as const,
              label: [...new Set(activity.map(({ label }) => label))].join(
                " · ",
              ),
              detail:
                activity.length > 1
                  ? `${activity.length} active cards`
                  : undefined,
              since: activity.length === 1 ? activity[0]!.since : undefined,
            }
          : node.data.status;
        return {
          ...node,
          data: { ...node.data, status, descendantCount, collapsed: !!group },
        };
      }),
    edges: edges.filter(
      ({ source, target }) =>
        byId.has(source) &&
        byId.has(target) &&
        !hidden.has(source) &&
        !hidden.has(target),
    ),
  };
}
