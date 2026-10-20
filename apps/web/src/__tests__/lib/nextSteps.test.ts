import { expect, it } from "vitest";
import type { CanvasEdge, CanvasNode, ChatMessage } from "shared";
import { nextSteps } from "../../lib/nextSteps";

const node = (id: string, kind: CanvasNode["kind"], payload = {}) =>
  ({ id, kind, payload: { title: id, ...payload } }) as CanvasNode;
const edge = (from: string, to: string, kind: CanvasEdge["kind"]) =>
  ({ id: `${from}-${to}`, fromNode: from, toNode: to, kind }) as CanvasEdge;
const asked = (text: string, target: string) =>
  ({ role: "user", text, target }) as ChatMessage;

it("settles what is decided first, then runs waiting checks, then untried hypotheses", () => {
  const nodes = [
    node("g", "goal", { status: "open" }),
    node("h1", "hypothesis", { label: "H1", status: "open" }),
    node("h2", "hypothesis", { label: "H2", status: "supported" }),
    node("c", "python", { title: "count lines" }),
    node("h3", "hypothesis", { label: "H3", status: "open" }),
  ];
  const edges = [edge("h1", "h2", "depends-on"), edge("g", "h1", "depends-on")];

  expect(
    nextSteps({ nodes, edges }, [asked("/prover H1", "h1")]).map(
      (s) => s.label,
    ),
  ).toEqual([
    "Mark H1 supported",
    'Run "count lines"',
    "/prover H3",
    "/literature H1",
  ]);
});

it("referees settled work and splits the goal when nothing is open", () => {
  const nodes = [
    node("g", "goal", { status: "open" }),
    node("h1", "hypothesis", { label: "H1", status: "refuted" }),
    node("old", "hypothesis", {
      label: "H9",
      status: "open",
      archived: { at: "" },
    }),
  ];

  expect(nextSteps({ nodes, edges: [] }, []).map((s) => s.label)).toEqual([
    "/referee H1",
    "/prover goal",
  ]);
});
