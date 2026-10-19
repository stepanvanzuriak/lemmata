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

const describeTarget = (card: CanvasNode) => {
  const { label, title } = fieldsOf(card);
  return `${card.kind}${label ? ` ${label}` : ""} "${title ?? card.id}" (id ${card.id})`;
};

function taskFor(command: Command, target: CanvasNode) {
  if (command.role === "referee") {
    return `Referee ${describeTarget(target)}: check the argument and its links, and report gaps as notes.`;
  }
  if (target.kind === "goal") {
    return `Split the goal ${describeTarget(target)} into hypotheses on the canvas.`;
  }
  return `Work on ${describeTarget(target)}: prove or refute it, with checks on the canvas.`;
}

/** The prompt sent to the model. The chat history keeps what the user typed. */
export function expandCommand(command: Command, target: CanvasNode): string {
  const task = taskFor(command, target);

  if (!command.instructions) {
    return task;
  }
  return `${task}\n\nUser instructions: ${command.instructions}`;
}

export function findTarget(detail: CanvasDetail, ref: string) {
  return findCard(detail, ref);
}

export class ConflictError extends Error {
  constructor(
    public readonly code: "claimed" | "busy" | "no_agent" | "no_target",
    message: string,
  ) {
    super(message);
    this.name = "ConflictError";
  }
}

/** Marks a hypothesis as being worked on by an agent. */
export async function claim(db: Db, node: CanvasNode, agent: CanvasAgent) {
  const p = node.payload as { status?: string; claimedBy?: string };

  if (node.kind !== "hypothesis") {
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
