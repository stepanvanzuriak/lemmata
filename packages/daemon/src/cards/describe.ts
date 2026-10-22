import {
  cardStatus,
  type CanvasDetail,
  type CanvasNode,
  type LiteraturePayload,
} from "shared";
import { editRight } from "./rights.js";
import { fieldsOf, isArchived, isResolved, type Author } from "./types.js";

const FULL_CHARS = 8_000;
const DETAIL_CHARS = 1_500;
const BRIEF_CHARS = 200;

type Level = "full" | "detail" | "brief" | "title";

export const clip = (text: string, max: number) =>
  text.length > max
    ? `${text.slice(0, max)}... [${text.length - max} more chars]`
    : text;

const nameOf = (card: CanvasNode) =>
  fieldsOf(card).label ?? `"${fieldsOf(card).title ?? card.id}"`;

function runLines(card: CanvasNode, max: number): string[] {
  const run = (
    card.payload as {
      run?: {
        badge: string;
        output: { stdout: string; stderr: string };
        figures?: unknown[];
      };
    }
  ).run;

  if (!run) {
    return card.kind === "python" || card.kind === "lean"
      ? ["  run: not run yet"]
      : [];
  }

  const count = run.figures?.length ?? 0;
  const figures =
    count > 0 && !run.badge.includes("figure")
      ? ` · ${count} figure${count > 1 ? "s" : ""}`
      : "";
  const lines = [`  run: ${run.badge}${figures}`];
  const output = [run.output.stdout, run.output.stderr]
    .filter((s) => s.trim())
    .join("\n");

  if (output && max > BRIEF_CHARS) {
    lines.push(`  output:\n${clip(output, max)}`);
  }
  return lines;
}

function literatureLines(card: CanvasNode, level: Level): string[] {
  if (card.kind !== "literature") {
    return [];
  }

  const p = card.payload as Partial<LiteraturePayload>;
  const papers = (p.papers ?? []).filter((paper) => !paper.dismissed);

  if (!p.checkedAt) {
    return ["  literature: not checked yet"];
  }

  const lines = [
    `  checked: ${p.checkedAt.slice(0, 10)} · ${papers.length} papers`,
  ];

  if (level === "brief") {
    return lines;
  }
  for (const paper of papers) {
    lines.push(
      `  - arXiv:${paper.id} "${paper.title}" (${paper.authors.slice(0, 3).join(", ")}${paper.authors.length > 3 ? " et al." : ""}, ${paper.published.slice(0, 4)}): ${paper.relevance ?? ""}`,
    );
  }
  if (p.suggestions?.length) {
    lines.push("  suggestions:", ...p.suggestions.map((s) => `  - ${s}`));
  }
  return lines;
}

function describeCard(
  card: CanvasNode,
  detail: CanvasDetail,
  author: Author,
  level: Level,
): string {
  const p = fieldsOf(card);
  const status = cardStatus(card, detail);
  const head = [
    `- [${card.id}] ${card.kind}`,
    p.label,
    `"${p.title ?? ""}"`,
    status && `status: ${status.label}`,
    isResolved(card) && "resolved",
    `you may change: ${editRight(card, author)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  if (level === "title") {
    return head;
  }

  const max = { full: FULL_CHARS, detail: DETAIL_CHARS, brief: BRIEF_CHARS }[
    level
  ];
  const lines = [head];

  if (p.text) {
    lines.push(`  text: ${clip(p.text, max)}`);
  }
  if (p.markdown && level !== "brief") {
    lines.push(`  markdown: ${clip(p.markdown, max)}`);
  }
  if (p.source && level !== "brief") {
    lines.push(`  source:\n${clip(p.source, max)}`);
  }
  lines.push(...runLines(card, max));
  lines.push(...literatureLines(card, level));

  return lines.join("\n");
}

function describeLinks(detail: CanvasDetail): string[] {
  const byId = new Map(detail.nodes.map((n) => [n.id, n]));

  return detail.edges.map((e) => {
    const from = byId.get(e.fromNode);
    const to = byId.get(e.toNode);
    return `- ${from ? nameOf(from) : e.fromNode} ${e.kind} ${to ? nameOf(to) : e.toNode}`;
  });
}

export function visibleDetail(detail: CanvasDetail): CanvasDetail {
  const nodes = detail.nodes.filter((n) => !isArchived(n));
  const ids = new Set(nodes.map((n) => n.id));

  return {
    ...detail,
    nodes,
    edges: detail.edges.filter((e) => ids.has(e.fromNode) && ids.has(e.toNode)),
  };
}

export function describeCanvas(
  full: CanvasDetail,
  author: Author,
  focus: string[] = [],
  budget = 60_000,
): string {
  const detail = visibleDetail(full);
  const hidden = full.nodes.length - detail.nodes.length;
  const focusIds = new Set(focus);
  const neighbours = new Set(
    detail.edges.flatMap((e) => {
      if (focusIds.has(e.fromNode)) {
        return [e.toNode];
      }
      if (focusIds.has(e.toNode)) {
        return [e.fromNode];
      }
      return [];
    }),
  );
  const levelOf = (card: CanvasNode): Level => {
    if (isResolved(card)) {
      return "title";
    }
    if (focusIds.has(card.id)) {
      return "full";
    }
    if (focusIds.size === 0 || neighbours.has(card.id)) {
      return "detail";
    }
    return "brief";
  };

  const links = describeLinks(detail);
  const header = [
    `Canvas "${detail.canvas.title}": ${detail.nodes.length} cards, ${links.length} links.`,
    hidden > 0 &&
      `${hidden} archived card${hidden > 1 ? "s are" : " is"} hidden; get_card still reads them by id.`,
    `Name cards by id, "goal", label (H2) or exact title.`,
  ]
    .filter(Boolean)
    .join(" ");
  let used = header.length + links.join("\n").length;
  const cards = detail.nodes.map((card) => {
    const text = describeCard(
      card,
      detail,
      author,
      used > budget ? "title" : levelOf(card),
    );
    used += text.length;
    return text;
  });

  return [
    header,
    "",
    "Cards:",
    ...cards,
    "",
    "Links:",
    ...(links.length ? links : ["- none"]),
  ].join("\n");
}

export function describeOne(
  card: CanvasNode,
  detail: CanvasDetail,
  author: Author,
): string {
  const links = describeLinks({
    ...detail,
    edges: detail.edges.filter(
      (e) => e.fromNode === card.id || e.toNode === card.id,
    ),
  });

  const archived = fieldsOf(card).archived;

  return [
    describeCard(card, detail, author, "full"),
    archived &&
      `  archived${archived.reason ? `: ${archived.reason}` : ""} (hidden from the canvas)`,
    "Links:",
    ...(links.length ? links : ["- none"]),
  ]
    .filter(Boolean)
    .join("\n");
}
