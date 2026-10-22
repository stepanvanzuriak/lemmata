import { addEdge, addNode, isoNow, updateNode, type Db } from "core";
import {
  LITERATURE_VERDICTS,
  type CanvasDetail,
  type CanvasNode,
  type LiteraturePayload,
  type LiteratureVerdict,
  type Paper,
  type PaperPayload,
} from "shared";
import type { ArxivClient } from "../arxiv/arxiv.js";
import { arxivId } from "../arxiv/atom.js";
import { findCard } from "./find.js";
import { loadDetail, toCanvasNode } from "./load.js";
import { freeSpot } from "./place.js";
import { editRight } from "./rights.js";
import { fieldsOf, isArchived, ToolRefusal, type RunContext } from "./types.js";

export const MAX_PAPERS = 8;
export const MAX_SUGGESTIONS = 6;

export type LiteratureRecord = {
  card: string;
  verdict: LiteratureVerdict;
  summary: string;
  suggestions?: string[];
  papers: { id: string; relevance: string }[];
  queries?: string[];
};

const literatureOf = (node: CanvasNode) =>
  node.payload as Partial<LiteraturePayload>;

const nameOf = (card: CanvasNode) =>
  fieldsOf(card).label ?? `"${fieldsOf(card).title ?? card.id}"`;

export function linkedLiterature(detail: CanvasDetail, target: CanvasNode) {
  return detail.nodes.find(
    (n) =>
      n.kind === "literature" &&
      !isArchived(n) &&
      literatureOf(n).target === target.id,
  );
}

export async function literatureCardFor(
  db: Db,
  detail: CanvasDetail,
  ref: CanvasNode,
): Promise<{ card: CanvasNode; target: CanvasNode }> {
  if (ref.kind === "literature") {
    const target = detail.nodes.find((n) => n.id === literatureOf(ref).target);
    return { card: ref, target: target ?? ref };
  }

  const existing = linkedLiterature(detail, ref);

  if (existing) {
    return { card: existing, target: ref };
  }

  const row = await addNode(db, {
    canvasId: ref.canvasId,
    kind: "literature",
    ...freeSpot(
      detail.nodes.filter((n) => !isArchived(n)),
      ref,
      "literature",
    ),
    payload: {
      title: `Literature: ${fieldsOf(ref).label ?? fieldsOf(ref).title ?? "goal"}`,
      target: ref.id,
      author: "Literature",
    },
    createdBy: "ai",
  });

  await addEdge(db, {
    canvasId: ref.canvasId,
    fromNode: ref.id,
    toNode: row.id,
    kind: "checked-by",
  });

  return { card: toCanvasNode(row), target: ref };
}

export async function recordLiterature(
  db: Db,
  arxiv: ArxivClient,
  run: RunContext,
  record: LiteratureRecord,
): Promise<CanvasNode> {
  const detail = await loadDetail(db, run.canvasId);
  const card = findCard(detail, record.card);

  if (!card || card.kind !== "literature") {
    throw new ToolRefusal(
      `"${record.card}" is not a literature card. Pass the id of the literature card named in the task.`,
    );
  }

  if (card.createdBy === "user" && editRight(card, run.author) !== "all") {
    throw new ToolRefusal(`You may not change ${nameOf(card)}.`);
  }
  if (!LITERATURE_VERDICTS.includes(record.verdict)) {
    throw new ToolRefusal(
      `verdict must be one of: ${LITERATURE_VERDICTS.join(", ")}.`,
    );
  }
  if (record.papers.length > MAX_PAPERS) {
    throw new ToolRefusal(`Keep at most ${MAX_PAPERS} papers.`);
  }
  if ((record.suggestions?.length ?? 0) > MAX_SUGGESTIONS) {
    throw new ToolRefusal(`Keep at most ${MAX_SUGGESTIONS} suggestions.`);
  }

  const seen = run.papers ?? new Map<string, Paper>();

  for (const node of detail.nodes) {
    const paper = node.payload as Partial<PaperPayload>;

    if (node.kind === "arxiv" && !isArchived(node) && paper.arxivId) {
      seen.set(paper.arxivId, {
        id: paper.arxivId,
        title: paper.title ?? paper.arxivId,
        authors: paper.authors ?? [],
        published: paper.published ?? "",
        abstract: paper.abstract ?? "",
        url: paper.url ?? `https://arxiv.org/abs/${paper.arxivId}`,
      });
    }
  }
  const wanted = record.papers.map((p) => ({ ...p, id: arxivId(p.id) }));
  const missing = wanted.filter((p) => !seen.has(p.id)).map((p) => p.id);

  for (const paper of await arxiv.byIds(missing)) {
    seen.set(paper.id, paper);
  }

  const unknown = wanted.filter((p) => !seen.has(p.id)).map((p) => p.id);

  if (unknown.length > 0) {
    throw new ToolRefusal(
      `arXiv has no paper ${unknown.join(", ")}. Use ids returned by search_literature.`,
    );
  }

  const previous = new Map(
    (literatureOf(card).papers ?? []).map((p) => [p.id, p]),
  );
  const papers: Paper[] = wanted.map(({ id, relevance }) => ({
    ...seen.get(id)!,
    relevance: relevance.trim(),
    dismissed: previous.get(id)?.dismissed,
  }));

  const row = await updateNode(db, card.id, {
    verdict: record.verdict,
    markdown: record.summary.trim(),
    suggestions: (record.suggestions ?? [])
      .map((s) => s.trim())
      .filter(Boolean),
    papers,
    queries: record.queries ?? literatureOf(card).queries,
    checkedAt: isoNow(),
  });

  return toCanvasNode(row!);
}
