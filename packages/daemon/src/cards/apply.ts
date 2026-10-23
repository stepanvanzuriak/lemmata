import { addEdge, addNode, updateNode, type Db } from "core";
import type { CanvasNode, EdgeKind, NodeKind } from "shared";
import { findCard } from "./find.js";
import { unpassedChecks } from "./gating.js";
import { loadDetail, toCanvasNode } from "./load.js";
import { freeSpot } from "./place.js";
import { editRight } from "./rights.js";
import {
  fieldsOf,
  isArchived,
  ToolRefusal,
  type CardFields,
  type RunContext,
} from "./types.js";

export const MAX_NEW_CARDS = 8;

export const CREATABLE_KINDS = [
  "statement",
  "hypothesis",
  "python",
  "lean",
  "note",
  "memory",
] as const satisfies readonly NodeKind[];

export type NewCard = Omit<CardFields, "agentId"> & {
  kind: (typeof CREATABLE_KINDS)[number];
  connectFrom?: string;
  edgeKind?: EdgeKind;
};

const STATUSES: Partial<Record<NodeKind, string[]>> = {
  goal: ["open", "proved", "disproved"],
  hypothesis: ["open", "supported", "refuted"],
};

const nameOf = (card: CanvasNode) =>
  fieldsOf(card).label ?? `"${fieldsOf(card).title ?? card.id}"`;

function nextLabel(nodes: CanvasNode[]) {
  const numbers = nodes
    .map((n) => Number(fieldsOf(n).label?.match(/^H(\d+)$/)?.[1]))
    .filter(Number.isFinite);

  return `H${Math.max(0, ...numbers) + 1}`;
}

function defaultEdge(kind: NodeKind): EdgeKind {
  if (kind === "python" || kind === "lean") {
    return "tested-by";
  }
  return "depends-on";
}

function withoutEmpty(fields: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
}

export async function createCards(
  db: Db,
  run: RunContext,
  cards: NewCard[],
): Promise<CanvasNode[]> {
  if (cards.length === 0 || cards.length > MAX_NEW_CARDS) {
    throw new ToolRefusal(
      `Send between 1 and ${MAX_NEW_CARDS} cards per call.`,
    );
  }

  const detail = await loadDetail(db, run.canvasId);
  const nodes = [...detail.nodes];
  const created: CanvasNode[] = [];

  for (const card of cards) {
    const { kind, connectFrom, edgeKind, ...fields } = card;
    const parentRef = connectFrom ?? run.target ?? "goal";
    const parent = findCard({ nodes }, parentRef);

    if (!fields.title?.trim()) {
      throw new ToolRefusal("Every card needs a title.");
    }
    if (!parent) {
      throw new ToolRefusal(
        `No card matches connectFrom "${parentRef}". Use an id, "goal", a label like H2, or an exact title.`,
      );
    }

    const isHypothesis = kind === "hypothesis";
    const payload = withoutEmpty({
      ...fields,
      label: isHypothesis ? (fields.label ?? nextLabel(nodes)) : fields.label,
      status: isHypothesis ? "open" : undefined,
      agentId: run.author.agentId,
      author:
        fields.author ??
        run.author.role[0]!.toUpperCase() + run.author.role.slice(1),
    });
    const row = await addNode(db, {
      canvasId: run.canvasId,
      kind,
      ...freeSpot(
        nodes.filter((n) => !isArchived(n)),
        parent,
        kind,
      ),
      payload,
      createdBy: "ai",
    });
    const node = toCanvasNode(row);

    await addEdge(db, {
      canvasId: run.canvasId,
      fromNode: parent.id,
      toNode: node.id,
      kind: edgeKind ?? defaultEdge(kind),
    });
    nodes.push(node);
    created.push(node);
  }

  return created;
}

export async function updateCard(
  db: Db,
  run: RunContext,
  ref: string,
  fields: CardFields,
): Promise<CanvasNode> {
  const detail = await loadDetail(db, run.canvasId);
  const card = findCard(detail, ref);
  const patch = withoutEmpty({ ...fields, agentId: undefined }) as CardFields;
  const keys = Object.keys(patch);

  if (!card) {
    throw new ToolRefusal(
      `No card matches "${ref}". Use an id, "goal", a label like H2, or an exact title.`,
    );
  }
  if (keys.length === 0) {
    throw new ToolRefusal("Nothing to change: pass at least one field.");
  }

  const right = editRight(card, run.author);

  if (right === "none") {
    throw new ToolRefusal(
      `You may not change ${nameOf(card)}. Add a note connected to it instead.`,
    );
  }
  if (right === "status" && keys.some((key) => key !== "status")) {
    throw new ToolRefusal(`You may only change the status of ${nameOf(card)}.`);
  }
  if (
    right === "body" &&
    keys.some((key) => !["status", "text", "markdown"].includes(key))
  ) {
    throw new ToolRefusal(
      `You may only change the status, text and markdown of ${nameOf(card)}.`,
    );
  }
  if (patch.status !== undefined) {
    const allowed = STATUSES[card.kind];

    if (!allowed?.includes(patch.status)) {
      throw new ToolRefusal(
        allowed
          ? `Status of a ${card.kind} must be one of: ${allowed.join(", ")}.`
          : `A ${card.kind} card has no status.`,
      );
    }
  }
  if (card.kind === "hypothesis" && patch.status === "supported") {
    const pending = unpassedChecks(detail, card);

    if (pending.length > 0) {
      throw new ToolRefusal(
        `${nameOf(card)} cannot be supported yet: ${pending.map(nameOf).join(", ")} ${pending.length > 1 ? "have" : "has"} not passed. Run them with run_card first.`,
      );
    }
  }

  const row = await updateNode(db, card.id, patch);
  return toCanvasNode(row!);
}
