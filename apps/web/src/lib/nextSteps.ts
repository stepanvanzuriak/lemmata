import {
  settleReady,
  type CanvasDetail,
  type CanvasNode,
  type ChatMessage,
} from "shared";

export type NextStep =
  | { kind: "command"; label: string; command: string }
  | { kind: "run"; label: string; nodeId: string }
  | { kind: "fetch"; label: string; nodeId: string }
  | { kind: "settle"; label: string; nodeId: string; status: string };

type Fields = {
  title?: string;
  label?: string;
  status?: string;
  run?: unknown;
  archived?: unknown;
  resolved?: unknown;
  target?: string;
  source?: unknown;
};

const fields = (node: CanvasNode) => node.payload as Fields;

const refOf = (node: CanvasNode) =>
  node.kind === "goal" ? "goal" : (fields(node).label ?? node.id);

const MAX_NAME = 36;

function shortTitle(title: string) {
  if (title.length <= MAX_NAME) {
    return title;
  }

  const cut = title.slice(0, MAX_NAME);
  const even = (cut.match(/\$/g)?.length ?? 0) % 2 === 0;
  const kept = even ? cut.trimEnd() : `${cut.trimEnd()}$`;

  return `${kept}...`;
}

function nameOf(node: CanvasNode) {
  const { label, title } = fields(node);

  if (node.kind === "goal") {
    return "goal";
  }
  if (label) {
    return label;
  }
  return title ? shortTitle(title) : node.id;
}

const GOAL_STATUS: Record<string, string> = {
  supported: "proved",
  refuted: "disproved",
};

export const MAX_STEPS = 4;

/**
 * What to do next, read off the canvas, so no run ends in a dead end: settle what is decided,
 * run checks waiting to run, work hypotheses no agent has tried, check the literature where
 * nobody has, referee what was settled, and split the goal when nothing else is left.
 */
export function nextSteps(
  detail: Pick<CanvasDetail, "nodes" | "edges">,
  messages: ChatMessage[],
): NextStep[] {
  const nodes = detail.nodes.filter((n) => !fields(n).archived);
  const asked = (command: string, node: CanvasNode) =>
    messages.some(
      (m) =>
        m.role === "user" &&
        m.text.trim().startsWith(command) &&
        m.target === node.id,
    );
  const hypotheses = nodes.filter((n) => n.kind === "hypothesis");
  const open = hypotheses.filter((n) =>
    ["open", "claimed", undefined].includes(fields(n).status),
  );
  const checked = new Set(
    nodes.filter((n) => n.kind === "literature").map((n) => fields(n).target),
  );
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const steps: NextStep[] = [];

  for (const node of nodes) {
    const ready = settleReady(node, detail);

    if (ready) {
      const status = node.kind === "goal" ? GOAL_STATUS[ready]! : ready;
      steps.push({
        kind: "settle",
        label: `Mark ${refOf(node)} ${status}`,
        nodeId: node.id,
        status,
      });
    }
  }

  for (const node of nodes) {
    if ((node.kind === "python" || node.kind === "lean") && !fields(node).run) {
      steps.push({
        kind: "run",
        label: `Run "${fields(node).title ?? "check"}"`,
        nodeId: node.id,
      });
    }
  }

  for (const node of nodes) {
    if (node.kind === "arxiv" && !fields(node).source) {
      steps.push({
        kind: "fetch",
        label: `Fetch "${nameOf(node)}"`,
        nodeId: node.id,
      });
    }
  }

  const refereed = new Set<string>();

  for (const node of nodes) {
    const gap = detail.edges.some((e) => {
      if (e.fromNode !== node.id || e.kind !== "checked-by") {
        return false;
      }
      const note = byId.get(e.toNode);

      return note?.kind === "note" && !fields(note).resolved;
    });

    if (gap && !asked("/prover", node)) {
      refereed.add(node.id);
      steps.push({
        kind: "command",
        label: `/prover ${nameOf(node)}`,
        command: `/prover ${refOf(node)}`,
      });
    }
  }

  for (const node of open.filter(
    (n) => !refereed.has(n.id) && !asked("/prover", n),
  )) {
    const command = `/prover ${refOf(node)}`;
    steps.push({ kind: "command", label: command, command });
  }

  for (const node of open.filter(
    (n) => !checked.has(n.id) && !asked("/literature", n),
  )) {
    const command = `/literature ${refOf(node)}`;
    steps.push({ kind: "command", label: command, command });
  }

  for (const node of hypotheses.filter(
    (n) =>
      ["supported", "refuted"].includes(fields(n).status ?? "") &&
      !asked("/referee", n),
  )) {
    const command = `/referee ${refOf(node)}`;
    steps.push({ kind: "command", label: command, command });
  }

  if (open.length === 0) {
    steps.push({
      kind: "command",
      label: "/prover goal",
      command: "/prover goal",
    });
  }

  return steps.slice(0, MAX_STEPS);
}
