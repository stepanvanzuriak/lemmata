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

it("asks the prover to answer open referee notes, by title when a card has no label", () => {
  const nodes = [
    node("g", "goal", { status: "open" }),
    node("h1", "hypothesis", { label: "H1", status: "open" }),
    node("n1", "note", { title: "Referee: H1 has no argument" }),
    node("01M5DH7QFJ", "statement", {
      title: "Melchior bound: $f_k(n)\\le n(n-1)/(k(k-1)+2(k-3))$",
    }),
    node("n2", "note", { title: "Referee: the remark is unsupported" }),
    node("n3", "note", {
      title: "Referee: already dealt with",
      resolved: { at: "2026-10-21T06:00:00.000Z" },
    }),
    node("lit", "literature", { title: "Literature: H1" }),
  ];
  const edges = [
    edge("h1", "n1", "checked-by"),
    edge("01M5DH7QFJ", "n2", "checked-by"),
    edge("01M5DH7QFJ", "n3", "checked-by"),
    edge("h1", "lit", "checked-by"),
  ];
  const steps = nextSteps({ nodes, edges }, []);

  expect(steps.map((s) => s.label)).toEqual([
    "/prover H1",
    "/prover Melchior bound: $f_k(n)\\le n(n-1)/(k$...",
    "/literature H1",
  ]);
  expect(steps[1]).toMatchObject({ command: "/prover 01M5DH7QFJ" });
});

it("drops a referee note step once the prover was already asked", () => {
  const nodes = [
    node("g", "goal", { status: "open" }),
    node("h1", "hypothesis", { label: "H1", status: "open" }),
    node("n1", "note", { title: "Referee: H1 has no argument" }),
  ];
  const edges = [edge("h1", "n1", "checked-by")];

  expect(
    nextSteps({ nodes, edges }, [asked("/prover H1", "h1")]).map(
      (s) => s.label,
    ),
  ).toEqual(["/literature H1"]);
});

it("a statement checked only by a literature card is not a gap", () => {
  const nodes = [
    node("g", "goal", { status: "open" }),
    node("s1", "statement", { title: "Melchior bound" }),
    node("lit", "literature", { title: "Literature: Melchior bound" }),
  ];
  const edges = [edge("s1", "lit", "checked-by")];

  expect(nextSteps({ nodes, edges }, []).map((s) => s.label)).toEqual([
    "/prover goal",
  ]);
});

it("offers to fetch a paper card that has no source yet", () => {
  const nodes = [
    node("g", "goal", { status: "open" }),
    node("p1", "arxiv", { title: "Few ordinary lines", arxivId: "1208.0053" }),
    node("p2", "arxiv", { title: "Read already", source: { sections: [] } }),
  ];

  expect(
    nextSteps({ nodes, edges: [] }, []).filter((s) => s.kind === "fetch"),
  ).toEqual([
    { kind: "fetch", label: 'Fetch "Few ordinary lines"', nodeId: "p1" },
  ]);
});

it("offers open attacks to the prover, ahead of untried hypotheses", () => {
  const nodes = [
    node("g", "goal", { status: "open" }),
    node("h1", "hypothesis", { label: "H1", status: "open" }),
    node("a1", "attack", { label: "A1", status: "open" }),
    node("a2", "attack", { label: "A2", status: "failed" }),
  ];
  const edges = [
    edge("h1", "a1", "depends-on"),
    edge("h1", "a2", "depends-on"),
  ];
  const labels = (messages: ChatMessage[]) =>
    nextSteps({ nodes, edges }, messages).map((s) => s.label);

  expect(labels([])).toEqual(["/prover A1", "/prover H1", "/literature H1"]);
  expect(labels([asked("/prover A1", "a1")])).toEqual([
    "/prover H1",
    "/literature H1",
  ]);
});
