import { addEdge, addNode, updateNode, type Db } from "core";
import {
  settleReady,
  type CanvasNode,
  type EdgeKind,
  type NodeKind,
} from "shared";
import { attackParent } from "../agents.js";
import { restoreIfArchived } from "./archive.js";
import { findCard } from "./find.js";
import { validateCardLatex } from "./latex.js";
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
  "attack",
  "python",
  "lean",
  "note",
  "memory",
  "toolbox",
] as const satisfies readonly NodeKind[];

export type NewCard = Omit<CardFields, "agentId"> & {
  kind: (typeof CREATABLE_KINDS)[number];
  connectFrom?: string;
  edgeKind?: EdgeKind;
};

const STATUSES: Partial<Record<NodeKind, string[]>> = {
  goal: ["open", "proved", "disproved"],
  hypothesis: ["open", "supported", "refuted"],
  attack: ["open", "worked", "failed"],
};

/** Statuses that record progress; moving to one stamps settledAt. A failed attack is not progress. */
const SETTLED_STATUSES = new Set([
  "proved",
  "disproved",
  "supported",
  "refuted",
  "worked",
]);

const nameOf = (card: CanvasNode) =>
  fieldsOf(card).label ?? `"${fieldsOf(card).title ?? card.id}"`;

/** Hypotheses are H1, H2, ...; attacks are A1, A2, ... */
function nextLabel(nodes: CanvasNode[], prefix: "H" | "A") {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  const numbers = nodes
    .map((n) => Number(fieldsOf(n).label?.match(pattern)?.[1]))
    .filter(Number.isFinite);

  return `${prefix}${Math.max(0, ...numbers) + 1}`;
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
  /** Collects explanations of adjustments made to the request, for the agent. */
  notices: string[] = [],
): Promise<CanvasNode[]> {
  if (cards.length === 0 || cards.length > MAX_NEW_CARDS) {
    throw new ToolRefusal(
      `Send between 1 and ${MAX_NEW_CARDS} cards per call.`,
    );
  }

  // Validate the whole batch before writing any cards so a retry is safe.
  for (const card of cards) {
    validateCardLatex(card);
  }

  const detail = await loadDetail(db, run.canvasId);
  const nodes = [...detail.nodes];
  const edges = [...detail.edges];
  const created: CanvasNode[] = [];

  for (const card of cards) {
    const { kind, connectFrom, edgeKind, ...fields } = card;
    const parentRef = connectFrom ?? run.target ?? "goal";
    let parent = findCard({ nodes }, parentRef);
    let redirected: CanvasNode | undefined;

    // A sub-lemma serves the hypothesis, not one route to it: it hangs from the
    // attack's hypothesis, so it outlives the attack if that fails.
    if (kind === "hypothesis" && parent?.kind === "attack") {
      const hypothesis = attackParent({ nodes, edges }, parent);
      if (hypothesis) {
        redirected = parent;
        parent = hypothesis;
      }
    }

    if (!fields.title?.trim()) {
      throw new ToolRefusal("Every card needs a title.");
    }
    if (!parent) {
      throw new ToolRefusal(
        `No card matches connectFrom "${parentRef}". Use an id, "goal", a label like H2, or an exact title.`,
      );
    }
    if (
      kind === "attack" &&
      parent.kind === "hypothesis" &&
      settleReady(parent, { nodes, edges })
    ) {
      throw new ToolRefusal(
        `${nameOf(parent)} is ready to settle, so it takes no new attacks. Prove or refute it with update_card, or reopen a flawed part first.`,
      );
    }
    if (kind === "toolbox" && nodes.some((node) => node.kind === "toolbox")) {
      throw new ToolRefusal(
        "This canvas already has a toolbox card. Update it instead.",
      );
    }

    const labelled = kind === "hypothesis" || kind === "attack";
    const payload = withoutEmpty({
      ...fields,
      label: labelled
        ? (fields.label ?? nextLabel(nodes, kind === "attack" ? "A" : "H"))
        : fields.label,
      status: labelled ? "open" : undefined,
      agentId: run.author.agentId,
      author:
        fields.author ??
        run.author.role[0]!.toUpperCase() + run.author.role.slice(1),
    });
    // Hanging new work from a hidden card brings it back.
    if (await restoreIfArchived(db, parent)) {
      const shown: CanvasNode = {
        ...parent,
        payload: { ...parent.payload, archived: null },
      };
      nodes[nodes.indexOf(parent)] = shown;
      parent = shown;
    }
    const row = await addNode(db, {
      canvasId: run.canvasId,
      kind,
      ...(await freeSpot(
        nodes.filter((n) => !isArchived(n)),
        parent,
        kind,
      )),
      payload,
      createdBy: "ai",
    });
    const node = toCanvasNode(row);

    edges.push(
      await addEdge(db, {
        canvasId: run.canvasId,
        fromNode: parent.id,
        toNode: node.id,
        kind: edgeKind ?? defaultEdge(kind),
      }),
    );
    nodes.push(node);
    created.push(node);
    if (redirected) {
      notices.push(
        `Hypothesis "${fields.title}" hangs from ${nameOf(parent)}, the hypothesis of ${nameOf(redirected)}, not from the attack, so it stays open if the attack fails. Cite it on the attack by its label.`,
      );
    }
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

  // Only the fields being written: old cards with bad math stay editable.
  validateCardLatex(patch);

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
  if (card.kind === "attack" && patch.status === "worked") {
    const pending = unpassedChecks(detail, card);

    if (pending.length > 0) {
      throw new ToolRefusal(
        `${nameOf(card)} cannot be marked worked yet: ${pending.map(nameOf).join(", ")} ${pending.length > 1 ? "have" : "has"} not passed. Run them with run_card first.`,
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

  // Writing to a hidden card brings it back, so the change is visible.
  if (isArchived(card)) {
    patch.archived = null;
  }
  const settles =
    patch.status !== undefined &&
    SETTLED_STATUSES.has(patch.status) &&
    patch.status !== fieldsOf(card).status;
  const row = await updateNode(
    db,
    card.id,
    settles ? { ...patch, settledAt: new Date().toISOString() } : patch,
  );
  return toCanvasNode(row!);
}
