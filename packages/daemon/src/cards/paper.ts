import { addEdge, addNode, updateNode, type Db } from "core";
import type { CanvasNode, PaperPayload } from "shared";
import type { ArxivClient } from "../arxiv/arxiv.js";
import { arxivId } from "../arxiv/atom.js";
import { loadPaper, type CachedPaper } from "../arxiv/papers.js";
import { findCard } from "./find.js";
import { loadDetail, toCanvasNode } from "./load.js";
import { freeSpot } from "./place.js";
import { isArchived, ToolRefusal, type RunContext } from "./types.js";

export type NewPaper = {
  id: string;
  connectFrom?: string;
  by?: "user" | "ai";
};

const paperOf = (node: CanvasNode) => node.payload as Partial<PaperPayload>;

export async function addPaper(
  db: Db,
  arxiv: ArxivClient,
  run: RunContext,
  { id, connectFrom, by = "ai" }: NewPaper,
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
  };

  const row = await addNode(db, {
    canvasId: run.canvasId,
    kind: "arxiv",
    ...freeSpot(
      detail.nodes.filter((n) => !isArchived(n)),
      parent,
      "arxiv",
    ),
    payload:
      by === "user"
        ? payload
        : {
            ...payload,
            author:
              run.author.role[0]!.toUpperCase() + run.author.role.slice(1),
            agentId: run.author.agentId,
          },
    createdBy: by,
  });

  await addEdge(db, {
    canvasId: run.canvasId,
    fromNode: parent.id,
    toNode: row.id,
    kind: "used-by",
  });

  return toCanvasNode(row);
}

export async function fetchPaperSource(
  db: Db,
  arxiv: ArxivClient,
  workspaceDir: string,
  run: RunContext,
  ref: string,
  { refresh = false } = {},
): Promise<{ card: CanvasNode; paper: CachedPaper }> {
  const card = findCard(await loadDetail(db, run.canvasId), ref);

  if (!card) {
    throw new ToolRefusal(
      `No card matches "${ref}". Call read_canvas to see the cards.`,
    );
  }
  if (card.kind !== "arxiv") {
    throw new ToolRefusal(`[${card.id}] is a ${card.kind} card, not a paper.`);
  }

  const { arxivId: id } = paperOf(card);

  if (!id) {
    throw new ToolRefusal(`[${card.id}] has no arXiv id.`);
  }

  const paper = await loadPaper(arxiv, workspaceDir, id, { refresh });

  if (refresh || !paperOf(card).source) {
    const row = await updateNode(db, card.id, {
      source: {
        fetchedAt: paper.meta.fetchedAt,
        file: paper.meta.file,
        bytes: paper.meta.bytes,
        sections: paper.sections.map(({ index, title }) => ({ index, title })),
      },
    });

    return { card: row ? toCanvasNode(row) : card, paper };
  }

  return { card, paper };
}
