import type { CardRun } from "./cards.js";
import type { CanvasDetail, CanvasNode } from "./canvas.js";

export type Tone = "ok" | "bad" | "warn" | "work" | "idle";

export type CardStatus = { tone: Tone; label: string; detail?: string };

export type CanvasGraph = Pick<CanvasDetail, "nodes" | "edges">;

type StatusFields = {
  status?: string;
  archived?: unknown;
  verdict?: string;
  author?: string;
  run?: CardRun;
  claimedByRole?: string;
};

const fields = (node: CanvasNode) => node.payload as StatusFields;

const roleName = (role?: string) =>
  role ? role[0]!.toUpperCase() + role.slice(1) : "Agent";

const CHECK_KINDS = new Set(["python", "lean"]);

function runStatus(node: CanvasNode): CardStatus {
  const run = fields(node).run;

  if (!run) {
    return { tone: "idle", label: "Not run" };
  }
  if (run.output.timedOut) {
    return { tone: "bad", label: "Timed out" };
  }
  if (node.kind === "lean" && run.output.exitCode !== null) {
    const errors = run.diagnostics?.some((d) => d.severity === "error");

    if (!errors && run.hasSorry) {
      return { tone: "warn", label: "Has sorry" };
    }
    if (!errors && run.extraAxioms?.length) {
      return {
        tone: "warn",
        label: "Extra axioms",
        detail: run.extraAxioms.join(", "),
      };
    }
  }

  return run.ok
    ? { tone: "ok", label: "Passed" }
    : { tone: "bad", label: "Failed", detail: run.badge };
}

function statementStatus(node: CanvasNode, graph: CanvasGraph): CardStatus {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const outgoing = graph.edges.filter((e) => e.fromNode === node.id);

  if (outgoing.some((e) => e.kind === "refuted-by")) {
    return { tone: "bad", label: "Refuted" };
  }

  const checks = outgoing
    .filter((e) => e.kind === "checked-by" || e.kind === "tested-by")
    .map((e) => byId.get(e.toNode))
    .filter((n): n is CanvasNode => Boolean(n && CHECK_KINDS.has(n.kind)))
    .map(runStatus);

  if (checks.some((s) => s.tone === "bad")) {
    return { tone: "bad", label: "Check failed" };
  }

  const issues = outgoing.filter((e) => {
    const target = byId.get(e.toNode);
    return (
      e.kind === "checked-by" &&
      target?.kind === "note" &&
      fields(target).author === "Referee"
    );
  }).length;

  if (issues > 0) {
    return {
      tone: "warn",
      label: `${issues} issue${issues > 1 ? "s" : ""}`,
    };
  }
  if (checks.length > 0 && checks.every((s) => s.tone === "ok")) {
    return { tone: "ok", label: "Checked" };
  }

  return { tone: "idle", label: "Unchecked" };
}

const GOAL_STATUS: Record<string, CardStatus> = {
  open: { tone: "idle", label: "Open" },
  proved: { tone: "ok", label: "Proved" },
  disproved: { tone: "bad", label: "Disproved" },
};

const LITERATURE_STATUS: Record<string, CardStatus> = {
  known: { tone: "ok", label: "Known result" },
  refuted: { tone: "bad", label: "Known counterexample" },
  partial: { tone: "warn", label: "Partial results" },
  related: { tone: "idle", label: "Related work" },
  novel: { tone: "idle", label: "Nothing found" },
};

const HYPOTHESIS_STATUS: Record<string, CardStatus> = {
  open: { tone: "idle", label: "Open" },
  supported: { tone: "ok", label: "Supported" },
  refuted: { tone: "bad", label: "Refuted" },
};

/** An open hypothesis whose parts already decide it says so on the card. */
function readyStatus(node: CanvasNode, graph: CanvasGraph): CardStatus | null {
  const ready = settleReady(node, graph);

  if (!ready) {
    return null;
  }
  return { tone: "warn", label: "Ready to settle", detail: ready };
}

export function cardStatus(
  node: CanvasNode,
  graph: CanvasGraph,
): CardStatus | null {
  const status = fields(node).status;

  switch (node.kind) {
    case "goal":
      return GOAL_STATUS[status ?? "open"] ?? GOAL_STATUS.open!;
    case "hypothesis":
      if (status === "claimed") {
        return {
          tone: "work",
          label: `${roleName(fields(node).claimedByRole)} working`,
        };
      }
      return (
        readyStatus(node, graph) ??
        HYPOTHESIS_STATUS[status ?? "open"] ??
        HYPOTHESIS_STATUS.open!
      );
    case "python":
    case "lean":
      return runStatus(node);
    case "statement":
      return statementStatus(node, graph);
    case "literature":
      return (
        LITERATURE_STATUS[fields(node).verdict ?? ""] ?? {
          tone: "idle",
          label: "Not checked",
        }
      );
    case "note":
      if (fields(node).author === "Referee") {
        return { tone: "warn", label: "Referee" };
      }
      return null;
    default:
      return null;
  }
}

/**
 * What the linked hypotheses already decide for a goal or an open hypothesis: refuted when a
 * refuted-by hypothesis is supported, supported when every depends-on hypothesis is. Null when
 * they decide nothing yet, or the card is settled. Archived links do not count.
 */
export function settleReady(
  card: CanvasNode,
  graph: CanvasGraph,
): "supported" | "refuted" | null {
  const status = fields(card).status;

  if (card.kind !== "goal" && card.kind !== "hypothesis") {
    return null;
  }
  if (status && status !== "open" && status !== "claimed") {
    return null;
  }

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const linked = (kind: string) =>
    graph.edges
      .filter((e) => e.fromNode === card.id && e.kind === kind)
      .map((e) => byId.get(e.toNode))
      .filter(
        (n): n is CanvasNode => n?.kind === "hypothesis" && !fields(n).archived,
      );
  const supported = (n: CanvasNode) => fields(n).status === "supported";

  if (linked("refuted-by").some(supported)) {
    return "refuted";
  }

  const parts = linked("depends-on");

  return parts.length > 0 && parts.every(supported) ? "supported" : null;
}

const GOAL_READY = { supported: "proved", refuted: "disproved" } as const;

export function goalReady(
  goal: CanvasNode,
  graph: CanvasGraph,
): "proved" | "disproved" | null {
  const ready = settleReady(goal, graph);
  return ready && GOAL_READY[ready];
}
