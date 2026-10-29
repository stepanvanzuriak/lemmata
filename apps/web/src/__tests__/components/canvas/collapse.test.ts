import { expect, it } from "vitest";
import type { CanvasNode, CardStatus } from "shared";
import { collapseCards } from "../../../components/canvas/collapse";
import type { CardFlowNode } from "../../../components/canvas/cards/CardNode";
import type { CardFlowEdge } from "../../../components/canvas/edges";

function node(
  id: string,
  status: CardStatus = { tone: "idle", label: "Open" },
): CardFlowNode {
  return {
    id,
    type: "card",
    position: { x: 100, y: 200 },
    data: {
      node: { id, kind: "hypothesis", payload: { title: id } } as CanvasNode,
      status,
    },
  };
}

function edge(source: string, target: string): CardFlowEdge {
  return { id: `${source}-${target}`, source, target };
}

it("hides every descendant and its edges, then restores original positions on expansion", () => {
  const nodes = [
    node("parent"),
    node("child"),
    node("grandchild"),
    node("other"),
  ];
  const edges = [
    edge("parent", "child"),
    edge("child", "grandchild"),
    edge("other", "child"),
  ];
  const result = collapseCards(nodes, edges, new Set(["parent"]));
  expect(result.nodes.map(({ id }) => id)).toEqual(["parent", "other"]);
  expect(result.nodes[0]!.data).toMatchObject({
    collapsed: true,
    descendantCount: 2,
  });
  expect(result.edges).toEqual([]);
  const expanded = collapseCards(nodes, edges, new Set());
  expect(expanded.nodes.map(({ id, position }) => ({ id, position }))).toEqual(
    nodes.map(({ id, position }) => ({ id, position })),
  );
  expect(expanded.edges).toEqual(edges);
});

it("updates a collapsed parent's activity as hidden prover and referee work starts and stops", () => {
  const nodes = [node("parent"), node("child"), node("grandchild")];
  const edges = [edge("parent", "child"), edge("child", "grandchild")];
  const collapsed = new Set(["parent", "child"]);
  nodes[2] = node("grandchild", { tone: "work", label: "Referee working" });
  expect(
    collapseCards(nodes, edges, collapsed).nodes[0]!.data.status,
  ).toMatchObject({
    tone: "work",
    label: "Referee working",
  });
  nodes[1] = node("child", { tone: "work", label: "Prover working" });
  expect(
    collapseCards(nodes, edges, collapsed).nodes[0]!.data.status,
  ).toMatchObject({
    tone: "work",
    detail: "2 active cards",
  });
  expect(
    collapseCards(nodes, edges, collapsed).nodes[0]!.data.status?.label,
  ).toContain("Prover working");
  nodes[1] = node("child");
  nodes[2] = node("grandchild");
  expect(collapseCards(nodes, edges, collapsed).nodes[0]!.data.status).toEqual(
    nodes[0]!.data.status,
  );
  const expanded = collapseCards(nodes, edges, new Set(["child"]));
  expect(expanded.nodes.map(({ id }) => id)).toEqual(["parent", "child"]);
  expect(expanded.nodes[1]!.data.collapsed).toBe(true);
});

it("handles cycles and shared descendants without hiding every card or double-counting work", () => {
  const nodes = [
    node("a"),
    node("b"),
    node("c", { tone: "work", label: "Prover working" }),
  ];
  const edges = [
    edge("a", "b"),
    edge("b", "a"),
    edge("a", "c"),
    edge("b", "c"),
  ];
  const result = collapseCards(nodes, edges, new Set(["a", "b"]));
  expect(result.nodes.map(({ id }) => id)).toEqual(["a"]);
  expect(result.nodes[0]!.data.status?.label).toBe("Prover working");
  expect(result.nodes[0]!.data.descendantCount).toBe(2);
});

it("keeps nested collapse state independent of the order cards arrived", () => {
  const result = collapseCards(
    [node("child"), node("parent"), node("grandchild")],
    [edge("parent", "child"), edge("child", "grandchild")],
    new Set(["child", "parent"]),
  );
  expect(result.nodes.map(({ id }) => id)).toEqual(["parent"]);
  expect(result.nodes[0]!.data.descendantCount).toBe(2);
});
