import { addEdge, addNode, type Db } from "core";
import type { CanvasNode, PaperPayload } from "shared";
import type { ArxivClient } from "../arxiv/arxiv.js";
import { arxivId } from "../arxiv/atom.js";
import { findCard } from "./find.js";
import { loadDetail, toCanvasNode } from "./load.js";
import { freeSpot } from "./place.js";
import { isArchived, ToolRefusal, type RunContext } from "./types.js";

export type NewPaper = { id: string; connectFrom?: string };

const paperOf = (node: CanvasNode) => node.payload as Partial<PaperPayload>;

export async function addPaper(
  db: Db,
  arxiv: ArxivClient,
  run: RunContext,
  { id, connectFrom }: NewPaper,
): Promise<CanvasNode> {
  const wanted = arxivId(id);

  const detail = await loadDetail(db, run.canvasId);
  const existing = detail.nodes.find(
    (n) =>
      n.kind === "arxiv" && !isArchived(n) && paperOf(n).arxivId === wanted,
  );

  if (existing) {
    return existing;
  }

  const parentRef = connectFrom ?? run.target ?? "goal";
  const parent = findCard(detail, parentRef);

  if (!parent) {
    throw new ToolRefusal(
      `No card matches connectFrom "${parentRef}". Use an id, "goal", a label like H2, or an exact title.`,
    );
  }

  const [paper] = await arxiv.byIds([wanted]);

  if (!paper) {
    throw new ToolRefusal(`arXiv has no paper ${wanted}.`);
  }

  const payload: PaperPayload = {
    kind: "arxiv",
    title: paper.title,
    arxivId: paper.id,
    authors: paper.authors,
    published: paper.published,
    abstract: paper.abstract,
    url: paper.url,
    author: run.author.role[0]!.toUpperCase() + run.author.role.slice(1),
  };

  const row = await addNode(db, {
    canvasId: run.canvasId,
    kind: "arxiv",
    ...freeSpot(
      detail.nodes.filter((n) => !isArchived(n)),
      parent,
      "arxiv",
    ),
    payload: { ...payload, agentId: run.author.agentId },
    createdBy: "ai",
  });

  await addEdge(db, {
    canvasId: run.canvasId,
    fromNode: parent.id,
    toNode: row.id,
    kind: "used-by",
  });

  return toCanvasNode(row);
}
