import { isoNow, updateNode, type Db } from "core";
import type { CanvasDetail, CanvasNode } from "shared";
import { findCard } from "./find.js";
import { loadDetail, toCanvasNode } from "./load.js";
import { fieldsOf, ToolRefusal, type RunContext } from "./types.js";

export function noteTarget(
  detail: CanvasDetail,
  note: CanvasNode,
): CanvasNode | undefined {
  if (note.kind !== "note") {
    return undefined;
  }

  const edge = detail.edges.find(
    (e) => e.kind === "checked-by" && e.toNode === note.id,
  );

  return detail.nodes.find((n) => n.id === edge?.fromNode);
}

export async function resolveNote(
  db: Db,
  run: RunContext,
  ref: string,
  reason: string,
): Promise<{ note: CanvasNode; target: CanvasNode }> {
  const detail = await loadDetail(db, run.canvasId);
  const note = findCard(detail, ref);

  if (!note) {
    throw new ToolRefusal(
      `No card matches "${ref}". Use an id or an exact title.`,
    );
  }

  const target = noteTarget(detail, note);

  if (!target) {
    throw new ToolRefusal(
      `[${note.id}] is not a referee note: only a note linked from a card with checked-by can be resolved.`,
    );
  }
  if (run.author.role === "referee") {
    throw new ToolRefusal(
      "The referee does not close its own notes. Report what you find and leave resolving to a prover run.",
    );
  }
  if (fieldsOf(note).resolved) {
    throw new ToolRefusal(`[${note.id}] is already resolved.`);
  }

  const row = await updateNode(db, note.id, {
    resolved: { at: isoNow(), by: run.attemptId, reason: reason.trim() },
  });

  return { note: toCanvasNode(row!), target };
}
