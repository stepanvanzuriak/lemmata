import {
  settleReady,
  type CanvasDetail,
  type CanvasNode,
  type ChatMessage,
} from "shared";

export type NextStep =
  | { kind: "command"; label: string; command: string }
  | { kind: "run"; label: string; nodeId: string }
  | { kind: "settle"; label: string; nodeId: string; status: string };

type Fields = {
  title?: string;
  label?: string;
  status?: string;
  run?: unknown;
  archived?: unknown;
  target?: string;
};

const fields = (node: CanvasNode) => node.payload as Fields;

const refOf = (node: CanvasNode) =>
  node.kind === "goal" ? "goal" : (fields(node).label ?? node.id);

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

  for (const node of open.filter((n) => !asked("/prover", n))) {
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
