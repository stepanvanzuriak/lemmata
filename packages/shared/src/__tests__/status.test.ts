import { describe, expect, it } from "vitest";
import type { CanvasEdge, CanvasNode, CardRun, EdgeKind } from "../index.js";
import { cardStatus, goalReady } from "../status.js";

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
