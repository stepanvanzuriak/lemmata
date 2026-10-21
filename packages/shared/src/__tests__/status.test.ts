import { describe, expect, it } from "vitest";
import type { CanvasEdge, CanvasNode, CardRun, EdgeKind } from "../index.js";
import { cardStatus, goalReady, settleReady } from "../status.js";

let ids = 0;

const node = (
  kind: CanvasNode["kind"],
  payload: Record<string, unknown> = {},
) =>
  ({
    id: `n${++ids}`,
    canvasId: "c",
    kind,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    createdBy: "user",
    createdAt: "",
    updatedAt: "",
    payload: { title: "t", ...payload },
  }) as CanvasNode;

const edge = (from: CanvasNode, to: CanvasNode, kind: EdgeKind) =>
  ({
    id: `e${++ids}`,
    canvasId: "c",
    fromNode: from.id,
    toNode: to.id,
    kind,
    createdAt: "",
    updatedAt: "",
  }) as CanvasEdge;

const run = (patch: Partial<CardRun> = {}): CardRun => ({
  ok: true,
  badge: "",
  runAt: "",
  output: {
    stdout: "",
    stderr: "",
    exitCode: 0,
    timedOut: false,
    durationMs: 1,
  },
  ...patch,
});

const alone = (n: CanvasNode) => cardStatus(n, { nodes: [n], edges: [] });

describe("cardStatus", () => {
  it.each([
    ["proved", "ok", "Proved"],
    ["disproved", "bad", "Disproved"],
    ["open", "idle", "Open"],
  ])("goal %s", (status, tone, label) => {
    expect(alone(node("goal", { status }))).toEqual({ tone, label });
  });

  it.each([
    ["supported", "ok", "Supported"],
    ["refuted", "bad", "Refuted"],
    ["open", "idle", "Open"],
  ])("hypothesis %s", (status, tone, label) => {
    expect(alone(node("hypothesis", { status }))).toEqual({ tone, label });
  });

  it("code without a run is not run", () => {
    expect(alone(node("python"))?.label).toBe("Not run");
  });

  it("code that passed / failed / timed out", () => {
    expect(alone(node("python", { run: run() }))?.label).toBe("Passed");
    expect(alone(node("python", { run: run({ ok: false }) }))?.label).toBe(
      "Failed",
    );
    expect(
      alone(
        node("python", {
          run: run({
            ok: false,
            output: { ...run().output, timedOut: true, exitCode: null },
          }),
        }),
      )?.label,
    ).toBe("Timed out");
  });

  it("lean with sorry or extra axioms warns", () => {
    expect(
      alone(node("lean", { run: run({ ok: false, hasSorry: true }) })),
    ).toMatchObject({ tone: "warn", label: "Has sorry" });
    expect(
      alone(node("lean", { run: run({ ok: false, extraAxioms: ["bad"] }) })),
    ).toMatchObject({ tone: "warn", label: "Extra axioms", detail: "bad" });
  });

  it("statement rules", () => {
    const s = node("statement");
    const pass = node("python", { run: run() });
    const fail = node("lean", { run: run({ ok: false }) });
    const referee = node("note", { author: "Referee" });
    const h = node("hypothesis");
    const nodes = [s, pass, fail, referee, h];
    const status = (...edges: CanvasEdge[]) =>
      cardStatus(s, { nodes, edges })?.label;

    expect(status()).toBe("Unchecked");
    expect(status(edge(s, pass, "tested-by"))).toBe("Checked");
    expect(
      status(edge(s, pass, "tested-by"), edge(s, fail, "checked-by")),
    ).toBe("Check failed");
    expect(status(edge(s, referee, "checked-by"))).toBe("1 issue");
    expect(status(edge(s, h, "refuted-by"))).toBe("Refuted");
  });

  it("notes: Referee warns, others have no status", () => {
    expect(alone(node("note", { author: "Referee" }))?.tone).toBe("warn");
    expect(alone(node("note"))).toBeNull();
  });
});

describe("goalReady", () => {
  it("proved when every depends-on hypothesis is supported", () => {
    const goal = node("goal", { status: "open" });
    const h1 = node("hypothesis", { status: "supported" });
    const h2 = node("hypothesis", { status: "supported" });
    const graph = {
      nodes: [goal, h1, h2],
      edges: [edge(goal, h1, "depends-on"), edge(goal, h2, "depends-on")],
    };

    expect(goalReady(goal, graph)).toBe("proved");
  });

  it("disproved when a refuting hypothesis is supported", () => {
    const goal = node("goal");
    const h = node("hypothesis", { status: "supported" });

    expect(
      goalReady(goal, {
        nodes: [goal, h],
        edges: [edge(goal, h, "refuted-by")],
      }),
    ).toBe("disproved");
  });

  it("not ready while a hypothesis is open or the goal is settled", () => {
    const goal = node("goal", { status: "open" });
    const h1 = node("hypothesis", { status: "supported" });
    const h2 = node("hypothesis", { status: "open" });
    const edges = [edge(goal, h1, "depends-on"), edge(goal, h2, "depends-on")];

    expect(goalReady(goal, { nodes: [goal, h1, h2], edges })).toBeNull();
    expect(
      goalReady(node("goal", { status: "proved" }), { nodes: [], edges: [] }),
    ).toBeNull();
  });
});

it("a claimed hypothesis is work in progress", () => {
  const h = node("hypothesis", { status: "claimed", claimedByRole: "prover" });

  expect(cardStatus(h, { nodes: [h], edges: [] })).toEqual({
    tone: "work",
    label: "Prover working",
  });
});

describe("settleReady for hypotheses", () => {
  it("a hypothesis whose sub-lemmas all hold is ready, and says so on the card", () => {
    const h1 = node("hypothesis", { status: "open" });
    const lemma = node("hypothesis", { status: "supported" });
    const graph = {
      nodes: [h1, lemma],
      edges: [edge(h1, lemma, "depends-on")],
    };

    expect(settleReady(h1, graph)).toBe("supported");
    expect(cardStatus(h1, graph)).toEqual({
      tone: "warn",
      label: "Ready to settle",
      detail: "supported",
    });
  });

  it("a supported counterexample makes it ready to refute; archived links do not count", () => {
    const h1 = node("hypothesis", { status: "claimed" });
    const counter = node("hypothesis", { status: "supported" });
    const gone = node("hypothesis", {
      status: "supported",
      archived: { at: "" },
    });

    expect(
      settleReady(h1, {
        nodes: [h1, counter],
        edges: [edge(h1, counter, "refuted-by")],
      }),
    ).toBe("refuted");
    expect(
      settleReady(h1, {
        nodes: [h1, gone],
        edges: [edge(h1, gone, "refuted-by")],
      }),
    ).toBeNull();
  });
});

describe("referee notes", () => {
  it("badges a referee note and marks it resolved once it is dealt with", () => {
    const open = node("note", { author: "Referee" });
    const done = node("note", {
      author: "Referee",
      resolved: { at: "2026-10-21T06:25:08.621Z", reason: "answered on H16" },
    });
    const plain = node("note", { author: "Prover" });
    const graph = { nodes: [open, done, plain], edges: [] };

    expect(cardStatus(open, graph)).toEqual({ tone: "warn", label: "Referee" });
    expect(cardStatus(done, graph)).toEqual({ tone: "ok", label: "Resolved" });
    expect(cardStatus(plain, graph)).toBeNull();
  });

  it("counts only unresolved referee notes against a statement", () => {
    const claim = node("statement");
    const open = node("note", { author: "Referee" });
    const done = node("note", { author: "Referee", resolved: { at: "x" } });
    const nodes = [claim, open, done];

    expect(
      cardStatus(claim, {
        nodes,
        edges: [
          edge(claim, open, "checked-by"),
          edge(claim, done, "checked-by"),
        ],
      }),
    ).toEqual({ tone: "warn", label: "1 issue" });

    expect(
      cardStatus(claim, { nodes, edges: [edge(claim, done, "checked-by")] }),
    ).toEqual({ tone: "idle", label: "Unchecked" });
  });
});
