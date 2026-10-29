import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { CanvasGraph, CanvasNode } from "shared";
import { AgentActions } from "../../../components/canvas/AgentActions";

const state = vi.hoisted(() => ({
  send: vi.fn(),
  mutate: vi.fn(),
  graph: { nodes: [], edges: [] } as CanvasGraph,
}));
vi.mock("../../../api/canvases", () => ({
  useCanvas: () => ({ data: state.graph }),
  useUpdateNode: () => ({ mutate: state.mutate, isPending: false }),
}));
vi.mock("../../../stores/chat", () => ({
  useChatStore: (select: (store: typeof state) => unknown) => select(state),
}));

function node(kind: CanvasNode["kind"], id = "card"): CanvasNode {
  return {
    id,
    canvasId: "c",
    kind,
    payload: { title: id, label: "H1", status: "open" },
  } as CanvasNode;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.graph = { nodes: [], edges: [] };
});

it("keeps the hypothesis hover actions available in the expanded view with their commands", () => {
  render(<AgentActions canvasId="c" node={node("hypothesis")} />);
  expect(
    screen.getAllByRole("button").map((button) => button.textContent),
  ).toEqual(["Prove", "Plan attack", "Referee", "Literature"]);
  for (const name of ["Prove", "Plan attack", "Referee", "Literature"]) {
    fireEvent.click(screen.getByRole("button", { name }));
  }
  expect(state.send.mock.calls.map(([command]) => command)).toEqual([
    "/prover H1",
    "/prover H1 Propose one attack on this hypothesis as a single attack card linked to it. Do not add more than one, and do not carry it out.",
    "/referee H1",
    "/literature H1",
  ]);
});

it.each([
  ["goal", "Split", "/prover goal"],
  ["attack", "Attack", "/prover H1"],
  ["statement", "Referee", "/referee H1"],
] as const)("preserves the %s action in the viewer", (kind, label, command) => {
  render(<AgentActions canvasId="c" node={node(kind)} />);
  fireEvent.click(screen.getByRole("button", { name: label }));
  expect(state.send).toHaveBeenCalledWith(command);
});

it("keeps the quick settle action and maps goal support to proved", () => {
  const goal = node("goal");
  const child = node("hypothesis", "child");
  child.payload = {
    ...child.payload,
    status: "supported",
  } as CanvasNode["payload"];
  state.graph = {
    nodes: [goal, child],
    edges: [
      { fromNode: goal.id, toNode: child.id, kind: "depends-on" },
    ] as CanvasGraph["edges"],
  };
  render(<AgentActions canvasId="c" node={goal} />);
  fireEvent.click(screen.getByRole("button", { name: "Mark proved" }));
  expect(state.mutate).toHaveBeenCalledWith({
    id: goal.id,
    patch: { status: "proved" },
  });
});

it("hides agent actions for archived cards", () => {
  const archived = node("hypothesis");
  archived.payload.archived = { at: "2026-10-27" };
  render(<AgentActions canvasId="c" node={archived} />);
  expect(screen.queryByRole("button")).toBeNull();
});
