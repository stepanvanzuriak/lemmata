import { cardStatus } from "shared";
import type {
  CanvasDetail,
  CanvasNode,
  EdgeKind,
  NodeKind,
  Paper,
} from "shared";
import {
  fieldsOf,
  isArchived,
  literatureOf,
  paperOf,
} from "../components/canvas/kinds";
import { escapeText, inline, markdownToTex, verbatim } from "./markdownTex";

/** A card's text and markdown body, both as the card viewer shows them. */
const body = (node: CanvasNode) =>
  [fieldsOf(node).text, fieldsOf(node).markdown]
    .map(markdownToTex)
    .filter(Boolean)
    .join("\n\n");

const prose = markdownToTex;

const heading = (node: CanvasNode) =>
  inline(fieldsOf(node).title) || "Untitled";

const label = (node: CanvasNode) => fieldsOf(node).label;

const arxivRef = (id: string) =>
  `\\href{https://arxiv.org/abs/${id}}{arXiv:${escapeText(id)}}`;

function paperLine(paper: Paper) {
  const authors = paper.authors.length
    ? `${escapeText(paper.authors.join(", "))}. `
    : "";
  const relevance = paper.relevance ? ` --- ${prose(paper.relevance)}` : "";

  return `\\item ${authors}\\emph{${escapeText(paper.title)}}, ${arxivRef(paper.id)}.${relevance}`;
}

export function canvasToLatex(detail: CanvasDetail, now = new Date()): string {
  const nodes = detail.nodes.filter((node) => !isArchived(node));
  const alive = new Set(nodes.map((node) => node.id));
  const edges = detail.edges.filter(
    ({ fromNode, toNode }) => alive.has(fromNode) && alive.has(toNode),
  );
  const graph = { nodes, edges };
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const ofKind = (kind: NodeKind) =>
    nodes
      .filter((node) => node.kind === kind)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const linked = (node: CanvasNode, kinds: EdgeKind[], toKind?: NodeKind) =>
    edges
      .filter((e) => e.fromNode === node.id && kinds.includes(e.kind))
      .map((e) => byId.get(e.toNode))
      .filter(
        (n): n is CanvasNode => Boolean(n) && (!toKind || n!.kind === toKind),
      );
  const statusOf = (node: CanvasNode) => {
    const status = cardStatus(node, graph);

    return status
      ? `${status.label}${status.detail ? ` (${status.detail})` : ""}`
      : "";
  };

  const goal = ofKind("goal")[0];
  const title =
    detail.canvas.title || (goal && fieldsOf(goal).title) || "Lemmata canvas";
  const out: string[] = [
    "\\documentclass[11pt]{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage{amsmath,amssymb,amsthm}",
    "\\usepackage[margin=1in]{geometry}",
    "\\usepackage[colorlinks=true]{hyperref}",
    "\\theoremstyle{definition}",
    "\\newtheorem{hypothesis}{Hypothesis}",
    "\\newtheorem{attack}{Attack}",
    "",
    `\\title{${inline(title)}}`,
    "\\author{Lemmata}",
    `\\date{${now.toISOString().slice(0, 10)}}`,
    "",
    "\\begin{document}",
    "\\maketitle",
    "",
  ];
  const section = (name: string, lines: string[]) => {
    if (lines.length > 0) {
      out.push(`\\section{${name}}`, ...lines, "");
    }
  };

  if (goal) {
    out.push(
      "\\begin{abstract}",
      `\\textbf{Goal} (${statusOf(goal)}): ${heading(goal)}`,
      ...(body(goal) ? ["", body(goal)] : []),
      "\\end{abstract}",
      "",
    );
  }

  section(
    "Statements",
    ofKind("statement").flatMap((node) => [
      `\\subsection*{${heading(node)}}`,
      `\\emph{Status: ${escapeText(statusOf(node))}}\\par`,
      body(node),
      "",
    ]),
  );

  section(
    "Hypotheses",
    ofKind("hypothesis").flatMap((node) => {
      const attacks = linked(node, ["depends-on"], "attack");
      const parts = linked(node, ["depends-on"], "hypothesis");
      const refuters = linked(node, ["refuted-by"], "hypothesis");
      const names = (list: CanvasNode[]) =>
        list.map((n) => label(n) ?? heading(n)).join(", ");

      return [
        `\\begin{hypothesis}[${heading(node)}${label(node) ? `; ${escapeText(label(node)!)}` : ""}]`,
        body(node),
        "\\end{hypothesis}",
        `\\noindent\\emph{Status: ${escapeText(statusOf(node))}.}`,
        ...(parts.length ? [`Depends on ${names(parts)}.`] : []),
        ...(refuters.length ? [`Refuted by ${names(refuters)}.`] : []),
        ...attacks.flatMap((attack) => [
          "",
          `\\begin{attack}[${heading(attack)}${label(attack) ? `; ${escapeText(label(attack)!)}` : ""}]`,
          body(attack),
          "\\end{attack}",
          `\\noindent\\emph{Status: ${escapeText(statusOf(attack))}.}`,
        ]),
        "",
      ];
    }),
  );

  const linkedAttacks = new Set(
    ofKind("hypothesis").flatMap((h) =>
      linked(h, ["depends-on"], "attack").map((a) => a.id),
    ),
  );

  section(
    "Other attacks",
    ofKind("attack")
      .filter((node) => !linkedAttacks.has(node.id))
      .flatMap((node) => [
        `\\begin{attack}[${heading(node)}]`,
        body(node),
        "\\end{attack}",
        `\\noindent\\emph{Status: ${escapeText(statusOf(node))}.}`,
        "",
      ]),
  );

  section(
    "Computations and checks",
    [...ofKind("python"), ...ofKind("lean")].flatMap((node) => {
      const p = node.payload as {
        source?: string;
        run?: { badge: string; output: { stdout: string; stderr: string } };
      };
      const run = p.run;

      return [
        `\\subsection*{${heading(node)} (${node.kind === "python" ? "Python" : "Lean"})}`,
        ...(p.source?.trim() ? [verbatim(p.source)] : []),
        `\\emph{Result: ${escapeText(statusOf(node))}${run ? `, ${escapeText(run.badge)}` : ""}.}`,
        ...(run?.output.stdout.trim()
          ? ["\\paragraph{Output}", verbatim(run.output.stdout.slice(0, 4000))]
          : []),
        "",
      ];
    }),
  );

  section(
    "Notes",
    ofKind("note").flatMap((node) => {
      const p = fieldsOf(node);

      return [
        `\\subsection*{${heading(node)}}`,
        ...(p.author || p.resolved
          ? [
              `\\emph{${[p.author, p.resolved ? "resolved" : ""]
                .filter(Boolean)
                .map((s) => escapeText(s!))
                .join(", ")}}\\par`,
            ]
          : []),
        body(node),
        "",
      ];
    }),
  );

  section(
    "Memory",
    ofKind("memory").flatMap((node) => [
      `\\subsection*{${heading(node)}}`,
      body(node),
      "",
    ]),
  );

  section(
    "Literature",
    ofKind("literature").flatMap((node) => {
      const lit = literatureOf(node);
      const papers = (lit.papers ?? []).filter((paper) => !paper.dismissed);

      return [
        `\\subsection*{${heading(node)}}`,
        `\\emph{Verdict: ${escapeText(statusOf(node))}.}`,
        body(node),
        ...(papers.length
          ? ["\\begin{itemize}", ...papers.map(paperLine), "\\end{itemize}"]
          : []),
        "",
      ];
    }),
  );

  const added = ofKind("arxiv");

  section(
    "Papers",
    added.length
      ? [
          "\\begin{itemize}",
          ...added.map((node) => {
            const p = paperOf(node);
            const authors = p.authors?.length
              ? `${escapeText(p.authors.join(", "))}. `
              : "";

            return `\\item ${authors}\\emph{${heading(node)}}${p.arxivId ? `, ${arxivRef(p.arxivId)}` : ""}.`;
          }),
          "\\end{itemize}",
        ]
      : [],
  );

  out.push("\\end{document}", "");

  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function downloadLatex(detail: CanvasDetail) {
  const name =
    (detail.canvas.title || "canvas")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "canvas";
  const url = URL.createObjectURL(
    new Blob([canvasToLatex(detail)], { type: "application/x-tex" }),
  );
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: `${name}.tex`,
  });

  link.click();
  URL.revokeObjectURL(url);
}
