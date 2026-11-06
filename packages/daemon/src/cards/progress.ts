import { isoNow, updateNode, type Db } from "core";
import {
  cardStatus,
  type CanvasDetail,
  type CanvasNode,
  type CardProgress,
} from "shared";
import { findCard } from "./find.js";
import { validateCardLatex } from "./latex.js";
import { loadDetail, toCanvasNode } from "./load.js";
import { editRight } from "./rights.js";
import { fieldsOf, isArchived, ToolRefusal, type RunContext } from "./types.js";

export const MAX_PROGRESS_ITEMS = 12;

export type ProgressInput = {
  established: { text: string; evidence: string[] }[];
  remaining: string[];
  next?: string;
};

const nameOf = (card: CanvasNode) =>
  fieldsOf(card).label ?? `"${fieldsOf(card).title ?? card.id}"`;

/** Why a card cannot back an established result, or null when it can. */
function evidenceProblem(card: CanvasNode, detail: CanvasDetail) {
  const { status } = fieldsOf(card);

  switch (card.kind) {
    case "python":
    case "lean":
      return cardStatus(card, detail)?.tone === "ok"
        ? null
        : "its check has not passed";
    case "hypothesis":
      return status === "supported" ? null : `it is ${status ?? "open"}`;
    case "attack":
      return status === "worked" ? null : `it is ${status ?? "open"}`;
    case "goal":
      return status === "proved" ? null : "the goal is not proved";
    case "arxiv":
    case "literature":
      return null;
    default:
      return `a ${card.kind} card is not checked evidence`;
  }
}

const normalize = (text: string) => text.trim().toLowerCase();

/**
 * Replaces the progress record of a hypothesis or attack. Every established item
 * must cite cards that establish it (passing checks, settled cards or papers), so
 * progress cannot be claimed in prose alone. advancedAt moves only when an
 * established item is new.
 */
export async function setProgress(
  db: Db,
  run: RunContext,
  ref: string,
  input: ProgressInput,
): Promise<{ card: CanvasNode; advanced: boolean; restored: boolean }> {
  const detail = await loadDetail(db, run.canvasId);
  const card = findCard(detail, ref);

  if (!card) {
    throw new ToolRefusal(
      `No card matches "${ref}". Use an id, a label like H2 or A3, or an exact title.`,
    );
  }
  if (card.kind !== "hypothesis" && card.kind !== "attack") {
    throw new ToolRefusal(
      `Progress is kept on hypotheses and attacks, not on a ${card.kind} card.`,
    );
  }
  if (editRight(card, run.author) === "none") {
    throw new ToolRefusal(`You may not change ${nameOf(card)}.`);
  }

  const problems: string[] = [];
  const established = input.established.map((item) => {
    if (item.evidence.length === 0) {
      problems.push(`"${item.text}" cites no evidence`);
    }
    const evidence = item.evidence.map((evidenceRef) => {
      const backing = findCard(detail, evidenceRef);
      const problem = backing
        ? evidenceProblem(backing, detail)
        : "no card matches";
      if (problem) {
        problems.push(`"${item.text}": ${evidenceRef} (${problem})`);
      }
      return backing?.id ?? evidenceRef;
    });
    return { text: item.text.trim(), evidence };
  });

  if (problems.length > 0) {
    throw new ToolRefusal(
      [
        "Every established item needs evidence: a passing python or lean check, a supported hypothesis, a worked attack or a paper card. Move unchecked steps to remaining.",
        ...problems.map((p) => `- ${p}`),
      ].join("\n"),
    );
  }
  validateCardLatex({
    markdown: [
      ...established.map((e) => e.text),
      ...input.remaining,
      input.next ?? "",
    ].join("\n"),
  });

  const previous = fieldsOf(card).progress;
  const known = new Set(
    (previous?.established ?? []).map((e) => normalize(e.text)),
  );
  const advanced = established.some((e) => !known.has(normalize(e.text)));
  const now = isoNow();
  const progress: CardProgress = {
    established,
    remaining: input.remaining.map((r) => r.trim()).filter(Boolean),
    ...(input.next?.trim() && { next: input.next.trim() }),
    updatedAt: now,
    ...((advanced ? now : previous?.advancedAt) && {
      advancedAt: advanced ? now : previous?.advancedAt,
    }),
  };
  const restored = isArchived(card);
  const row = await updateNode(db, card.id, {
    progress,
    ...(restored && { archived: null }),
  });

  return { card: toCanvasNode(row!), advanced, restored };
}

/** The progress record as agents read it; brief gives one line. */
export function describeProgress(
  progress: CardProgress,
  detail: Pick<CanvasDetail, "nodes">,
  brief = false,
): string[] {
  const label = (id: string) => {
    const card = detail.nodes.find((n) => n.id === id);
    return card ? (fieldsOf(card).label ?? id) : id;
  };

  if (brief) {
    return [
      `  progress: ${progress.established.length} established, ${progress.remaining.length} remaining${progress.next ? `; next: ${progress.next.slice(0, 160)}` : ""}`,
    ];
  }
  return [
    `  progress (updated ${progress.updatedAt.slice(0, 16)}):`,
    "    established:",
    ...(progress.established.length
      ? progress.established.map(
          (e) => `    - ${e.text} [${e.evidence.map(label).join(", ")}]`,
        )
      : ["    - none yet"]),
    "    remaining:",
    ...(progress.remaining.length
      ? progress.remaining.map((r) => `    - ${r}`)
      : ["    - none"]),
    ...(progress.next ? [`    next: ${progress.next}`] : []),
  ];
}
