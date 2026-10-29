import { isoNow, updateNode, type Db } from "core";
import type { CanvasDetail, CanvasNode } from "shared";
import { findCard } from "./find.js";
import { loadDetail } from "./load.js";
import { fieldsOf, isArchived, ToolRefusal, type RunContext } from "./types.js";

export const MAX_ARCHIVE = 20;

const nameOf = (card: CanvasNode) =>
  fieldsOf(card).label ?? `"${fieldsOf(card).title ?? card.id}"`;

const neighbours = (detail: CanvasDetail, card: CanvasNode) => {
  const byId = new Map(detail.nodes.map((n) => [n.id, n]));

  return detail.edges.flatMap((e) => {
    if (e.fromNode === card.id) {
      return [byId.get(e.toNode)];
    }
    if (e.toNode === card.id) {
      return [byId.get(e.fromNode)];
    }
    return [];
  });
};

export function keepReason(
  detail: CanvasDetail,
  card: CanvasNode,
): string | null {
  const status = fieldsOf(card).status;

  if (card.kind === "goal") {
    return "the goal stays";
  }
  if (card.kind === "toolbox") {
    return "the toolbox is shared canvas infrastructure; use delete_toolbox if it is no longer useful";
  }
  if (card.createdBy === "user") {
    return "it is the user's card";
  }
  if (card.kind === "hypothesis" && status !== "refuted") {
    return `it is ${status ?? "open"}; only refuted hypotheses are archived`;
  }

  if (card.kind === "attack" && status !== "failed") {
    return `it is ${status ?? "open"}; only failed attacks are archived`;
  }

  const backs = neighbours(detail, card).find(
    (n) =>
      n &&
      !isArchived(n) &&
      n.kind === "hypothesis" &&
      fieldsOf(n).status === "supported",
  );

  if (backs) {
    return `it is linked to ${nameOf(backs)}, which is supported`;
  }
  return null;
}

export async function archiveNodes(
  db: Db,
  ids: string[],
  archived: { by?: string; reason: string },
) {
  const at = isoNow();

  for (const id of ids) {
    await updateNode(db, id, { archived: { at, ...archived } });
  }
}

export async function archiveCards(
  db: Db,
  run: RunContext,
  refs: string[],
  reason: string,
) {
  if (refs.length === 0 || refs.length > MAX_ARCHIVE) {
    throw new ToolRefusal(`Send between 1 and ${MAX_ARCHIVE} cards.`);
  }

  const detail = await loadDetail(db, run.canvasId);
  const archived: CanvasNode[] = [];
  const refused: string[] = [];

  for (const ref of refs) {
    const card = findCard(detail, ref);

    if (!card) {
      refused.push(`"${ref}": no card matches`);
      continue;
    }
    if (isArchived(card)) {
      continue;
    }

    const keep = keepReason(detail, card);

    if (keep) {
      refused.push(`${nameOf(card)}: ${keep}`);
      continue;
    }

    await updateNode(db, card.id, {
      archived: { at: isoNow(), by: run.attemptId, reason: reason.trim() },
    });
    archived.push(card);
  }

  return { archived, refused };
}
