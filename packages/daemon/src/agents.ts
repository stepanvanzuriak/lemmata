import { updateNode, type AgentRole, type CanvasAgent, type Db } from "core";
import type { CanvasDetail, CanvasNode } from "shared";
import { findCard } from "./cards/find.js";
import { fieldsOf } from "./cards/types.js";

export type Command = {
  role: AgentRole;
  ref: string;
  instructions: string;
};

const COMMAND = /^\/(prover|referee)\s+(\S+)\s*([\s\S]*)$/;

/** `/prover <ref> [instructions]` or `/referee <ref> [instructions]`; anything else is for the Assistant. */
export function parseCommand(text: string): Command | null {
  const match = text.trim().match(COMMAND);

  if (!match) {
    return null;
  }

  return {
    role: match[1] as AgentRole,
    ref: match[2]!,
    instructions: match[3]!.trim(),
  };
}

/** Batch refs: `/prover open` works through the open hypotheses, `/referee settled` reviews the settled ones. */
const BATCH: Record<AgentRole, { ref: string; statuses: string[] }> = {
  prover: { ref: "open", statuses: ["open"] },
  referee: { ref: "settled", statuses: ["supported", "refuted"] },
};
const MAX_BATCH = 3;

export const isBatch = (command: Command) =>
  command.ref.toLowerCase() === BATCH[command.role].ref;

function batchTargets(command: Command, detail: CanvasDetail) {
  const { statuses } = BATCH[command.role];

  return detail.nodes
    .filter(
      (n) =>
        n.kind === "hypothesis" &&
        statuses.includes(fieldsOf(n).status ?? "open"),
    )
    .map((n) => fieldsOf(n).label ?? n.id)
    .slice(0, MAX_BATCH);
}

const describeTarget = (card: CanvasNode) => {
  const { label, title } = fieldsOf(card);
  return `${card.kind}${label ? ` ${label}` : ""} "${title ?? card.id}" (id ${card.id})`;
};

function batchTask(command: Command, detail: CanvasDetail) {
  const labels = batchTargets(command, detail);

  if (labels.length === 0) {
    return command.role === "prover"
      ? "There are no open hypotheses. Say so and add nothing."
      : "There are no supported or refuted hypotheses to review. Say so and add nothing.";
  }

  const list = labels.join(", ");

  if (command.role === "referee") {
    return `Referee these hypotheses one at a time, in order: ${list}. For each, re-run its checks when the result matters and report gaps as notes. Finish with one line per hypothesis: holds, or what is wrong.`;
  }
  return `Work through these open hypotheses one at a time, in order: ${list}. For each, prefer a computation that could settle or sharpen it over restating an approach that already failed on the canvas. Stop after these ${labels.length}, then say in one line per hypothesis what changed.`;
}

/** The hypothesis an attack hangs from: the card that links to it. */
export function attackParent(
  detail: Pick<CanvasDetail, "nodes" | "edges">,
  attack: CanvasNode,
) {
  const edge = detail.edges.find((e) => e.toNode === attack.id);

  return detail.nodes.find(
    (n) => n.id === edge?.fromNode && n.kind === "hypothesis",
  );
}

function attackTask(target: CanvasNode, detail?: CanvasDetail) {
  const parent = detail && attackParent(detail, target);
  const on = parent ? ` on ${describeTarget(parent)}` : "";

  return `Carry out the attack ${describeTarget(target)}${on}: work through the argument on its card, with checks on the canvas. Mark the attack worked with update_card only when the argument is complete and its checks pass; when it fails, mark it failed and say on the card where and why it breaks. Do not settle the hypothesis from this run alone. If the failure suggests another route, add it as a new attack linked to the hypothesis.`;
}

function taskFor(command: Command, target: CanvasNode, detail?: CanvasDetail) {
  if (command.role === "referee") {
    return `Referee ${describeTarget(target)}: check the argument and its links, and report gaps as notes.`;
  }
  if (target.kind === "attack") {
    return attackTask(target, detail);
  }
  if (target.kind === "goal") {
    return `Split the goal ${describeTarget(target)} into hypotheses on the canvas.`;
  }
  return `Work on ${describeTarget(target)}: prove or refute it, with checks on the canvas.`;
}

/** The prompt sent to the model. The chat history keeps what the user typed. */
export function expandCommand(
  command: Command,
  target: CanvasNode,
  detail?: CanvasDetail,
): string {
  const task =
    detail && isBatch(command)
      ? batchTask(command, detail)
      : taskFor(command, target, detail);

  if (!command.instructions) {
    return task;
  }
  return `${task}\n\nUser instructions: ${command.instructions}`;
}

/** A batch ref targets the goal, so the run has the whole canvas in focus. */
export function findTarget(detail: CanvasDetail, command: Command) {
  return findCard(detail, isBatch(command) ? "goal" : command.ref);
}

export class ConflictError extends Error {
  constructor(
    public readonly code:
      "claimed" | "busy" | "no_agent" | "no_target" | "no_provider",
    message: string,
  ) {
    super(message);
    this.name = "ConflictError";
  }
}

/** Marks a hypothesis or attack as being worked on by an agent. */
export async function claim(db: Db, node: CanvasNode, agent: CanvasAgent) {
  const p = node.payload as { status?: string; claimedBy?: string };

  if (node.kind !== "hypothesis" && node.kind !== "attack") {
    return;
  }
  if (p.claimedBy && p.claimedBy !== agent.id) {
    throw new ConflictError(
      "claimed",
      `${describeTarget(node)} is claimed by another agent.`,
    );
  }

  await updateNode(db, node.id, {
    claimedBy: agent.id,
    claimedByRole: agent.role,
    ...(p.status === "open" || p.status === undefined
      ? { status: "claimed" }
      : {}),
  });
}

export async function release(db: Db, nodeId: string, agent: CanvasAgent) {
  const row = await db.query.canvasNode.findFirst({ where: { id: nodeId } });

  if (!row) {
    return;
  }

  const p = JSON.parse(row.payload) as { status?: string; claimedBy?: string };

  if (p.claimedBy !== agent.id) {
    return;
  }

  await updateNode(db, nodeId, {
    claimedBy: undefined,
    claimedByRole: undefined,
    ...(p.status === "claimed" ? { status: "open" } : {}),
  });
}
