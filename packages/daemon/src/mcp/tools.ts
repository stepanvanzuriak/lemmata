import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { addEdge, addMemory, EDGE_KINDS, MEMORY_KINDS, type Db } from "core";
import {
  LITERATURE_VERDICTS,
  type CanvasNode,
  type CardFigure,
  type CardRun,
  type Paper,
  type Toolchain,
} from "shared";
import { z } from "zod";
import { ArxivError, type ArxivClient } from "../arxiv/arxiv.js";
import { MAX_RESULTS } from "../arxiv/constants.js";
import { archiveCards, MAX_ARCHIVE } from "../cards/archive.js";
import {
  CREATABLE_KINDS,
  createCards,
  MAX_NEW_CARDS,
  updateCard,
} from "../cards/apply.js";
import { describeCanvas, describeOne } from "../cards/describe.js";
import { findCard } from "../cards/find.js";
import { settleNudge } from "../cards/goal.js";
import {
  MAX_PAPERS,
  MAX_SUGGESTIONS,
  recordLiterature,
} from "../cards/literature.js";
import { loadDetail, toCanvasNode } from "../cards/load.js";
import { resolveNote } from "../cards/resolve.js";
import { fieldsOf, ToolRefusal, type RunContext } from "../cards/types.js";
import { figuresDir, RUNNABLE_KINDS, runCardNode } from "../runCard.js";

export type ToolDeps = {
  db: Db;
  workspaceDir: string;
  toolchain: Promise<Toolchain>;
  arxiv: ArxivClient;
};

const text = (value: string): CallToolResult => ({
  content: [{ type: "text", text: value }],
});

async function guardResult(
  work: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  try {
    return await work();
  } catch (error) {
    const message =
      error instanceof ToolRefusal ||
      error instanceof ArxivError ||
      error instanceof Error
        ? error.message
        : String(error);
    return { ...text(message), isError: true };
  }
}

const guard = (work: () => Promise<string>) =>
  guardResult(async () => text(await work()));

const cardRef = z
  .string()
  .describe(
    'Card id, "goal", a hypothesis label such as H2, or an exact title',
  );

const cardFields = {
  title: z
    .string()
    .optional()
    .describe("Short; math in $...$ as everywhere, e.g. $f_k(n) = o(n^2)$"),
  text: z
    .string()
    .optional()
    .describe("One or two sentences shown on the card"),
  markdown: z
    .string()
    .optional()
    .describe("Full body; math in $...$ or $$...$$"),
  label: z.string().optional().describe("Hypothesis label such as H3"),
  source: z.string().optional().describe("Code for python and lean cards"),
};

const newCard = z.object({
  kind: z.enum(CREATABLE_KINDS),
  ...cardFields,
  connectFrom: z
    .string()
    .optional()
    .describe("Parent card (also one created earlier in this call)"),
  edgeKind: z.enum(EDGE_KINDS).optional(),
});

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 1024 * 1024;

type Picture = { figure: CardFigure; file: string };

function picturesOf(figures: CardFigure[]): Picture[] {
  return figures.slice(0, MAX_IMAGES).map((figure) => ({
    figure,
    file: figure.is3d && figure.views ? figure.views : figure.name,
  }));
}

function describeRun(card: CanvasNode, attached: Set<string>, notes: string[]) {
  const run = (card.payload as { run?: CardRun }).run;

  if (!run) {
    return "No result.";
  }

  const figures = (run.figures ?? []).map(({ name, title, is3d, views }) => {
    const label = title ? `${name} "${title}"` : name;
    const strip = is3d && views && attached.has(views);

    if (strip) {
      return `${label} (3D, 4 angles attached)`;
    }
    return is3d ? `${label} (3D)` : label;
  });

  return [
    `Result: ${run.badge} (${run.ok ? "passed" : "not passed"})`,
    run.output.stdout.trim() && `stdout:\n${run.output.stdout}`,
    run.output.stderr.trim() && `stderr:\n${run.output.stderr}`,
    run.diagnostics?.length &&
      `diagnostics:\n${run.diagnostics.map((d) => `${d.line}:${d.column} ${d.severity}: ${d.message}`).join("\n")}`,
    run.axioms?.length && `axioms: ${run.axioms.join(", ")}`,
    figures.length && `figures:\n${figures.join("\n")}`,
    notes.length && notes.join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function runResult(
  card: CanvasNode,
  dir: string,
): Promise<CallToolResult> {
  const run = (card.payload as { run?: CardRun }).run;
  const images: CallToolResult["content"] = [];
  const attached = new Set<string>();
  const notes: string[] = [];

  for (const { file } of picturesOf(run?.figures ?? [])) {
    const path = join(dir, file);
    const size = await stat(path)
      .then((s) => s.size)
      .catch(() => null);

    if (size === null) {
      continue;
    }
    if (size > MAX_IMAGE_BYTES) {
      notes.push(`${file} is over 1 MB and was not attached.`);
      continue;
    }

    images.push({
      type: "image",
      data: (await readFile(path)).toString("base64"),
      mimeType: "image/png",
    });
    attached.add(file);
  }

  return {
    content: [
      { type: "text", text: describeRun(card, attached, notes) },
      ...images,
    ],
  };
}

const ABSTRACT_CHARS = 700;

function describePaper(paper: Paper) {
  const authors = `${paper.authors.slice(0, 4).join(", ")}${paper.authors.length > 4 ? " et al." : ""}`;
  const abstract =
    paper.abstract.length > ABSTRACT_CHARS
      ? `${paper.abstract.slice(0, ABSTRACT_CHARS)}...`
      : paper.abstract;

  return `- arXiv:${paper.id} "${paper.title}" — ${authors} (${paper.published})\n  ${abstract}`;
}

/** Roles that may hide cards; agents doing research must not tidy their own trail away. */
const ARCHIVERS = new Set(["curator", "assistant"]);

export const MAX_MEMORY_ENTRIES = 3;
export const MAX_MEMORY_CHARS = 300;

export function registerTools(
  server: McpServer,
  run: RunContext,
  { db, workspaceDir, toolchain, arxiv }: ToolDeps,
) {
  const detail = () => loadDetail(db, run.canvasId);
  const find = async (ref: string) => {
    const current = await detail();
    const card = findCard(current, ref);

    if (!card) {
      throw new ToolRefusal(
        `No card matches "${ref}". Call read_canvas to see the cards.`,
      );
    }
    return { card, current };
  };

  server.registerTool(
    "read_canvas",
    {
      description:
        "List every card (id, kind, status, what you may change) and the links. Pass focus to see some cards in full.",
      inputSchema: { focus: z.array(cardRef).optional() },
    },
    ({ focus }) =>
      guard(async () => {
        const current = await detail();
        const ids = (focus ?? run.focus ?? [])
          .map((ref) => findCard(current, ref)?.id)
          .filter((id): id is string => Boolean(id));

        return describeCanvas(current, run.author, ids);
      }),
  );

  server.registerTool(
    "get_card",
    {
      description: "Read one card in full: body, code, last run output, links.",
      inputSchema: { id: cardRef },
    },
    ({ id }) =>
      guard(async () => {
        const { card, current } = await find(id);
        return describeOne(card, current, run.author);
      }),
  );

  server.registerTool(
    "create_cards",
    {
      description: [
        `Add up to ${MAX_NEW_CARDS} cards; returns their ids. Give each a title and text (short, shown on the card) or markdown (full body).`,
        "Kinds: statement (lemma, claim, definition, finished proof in markdown), hypothesis (approach or conjecture to check; starts open, label given automatically), python (self-contained check in source, runs in a fresh process), lean (Lean 4 in source, main theorem first), note (remark or question for the user), memory (dead end or fact worth keeping).",
        "connectFrom names the parent (may be a card earlier in this call; default: the run's target or the goal). edgeKind defaults to tested-by for python/lean and depends-on otherwise; use refuted-by for evidence against a claim.",
      ].join(" "),
      inputSchema: { cards: z.array(newCard).min(1).max(MAX_NEW_CARDS) },
    },
    ({ cards }) =>
      guard(async () => {
        const created = await createCards(db, run, cards);
        return created
          .map(
            (c) =>
              `Created ${c.kind} [${c.id}]${fieldsOf(c).label ? ` ${fieldsOf(c).label}` : ""} "${fieldsOf(c).title}"`,
          )
          .join("\n");
      }),
  );

  server.registerTool(
    "update_card",
    {
      description:
        "Change some fields of a card; fields you leave out stay. status: open/supported/refuted for hypotheses, open/proved/disproved for the goal. Changing source clears the last run.",
      inputSchema: {
        id: cardRef,
        ...cardFields,
        status: z.string().optional(),
      },
    },
    ({ id, ...fields }) =>
      guard(async () => {
        const card = await updateCard(db, run, id, fields);
        const nudge = settleNudge(await detail());

        return [`Updated [${card.id}] "${fieldsOf(card).title}".`, nudge]
          .filter(Boolean)
          .join("\n");
      }),
  );

  server.registerTool(
    "resolve_note",
    {
      description: [
        "Mark a referee note as dealt with, once the canvas answers it: the note stays but stops being shown in full to later runs.",
        "reason: one line on what answers it, naming the cards. Only a note linked from a card with checked-by can be resolved, and only after the work is on the canvas — not because you disagree with it.",
      ].join(" "),
      inputSchema: { id: cardRef, reason: z.string().min(1) },
    },
    ({ id, reason }) =>
      guard(async () => {
        const { note, target } = await resolveNote(db, run, id, reason);

        return `Resolved [${note.id}] "${fieldsOf(note).title}" on ${fieldsOf(target).label ?? `[${target.id}]`}.`;
      }),
  );

  server.registerTool(
    "connect_cards",
    {
      description:
        "Link two existing cards (no duplicates). from depends-on to: from needs to. from tested-by/checked-by to: to is a check of from. from refuted-by to: to is evidence against from. from used-by to: to builds on from.",
      inputSchema: { from: cardRef, to: cardRef, kind: z.enum(EDGE_KINDS) },
    },
    ({ from, to, kind }) =>
      guard(async () => {
        const source = (await find(from)).card;
        const target = (await find(to)).card;

        if (source.id === target.id) {
          throw new ToolRefusal("A card cannot link to itself.");
        }

        await addEdge(db, {
          canvasId: run.canvasId,
          fromNode: source.id,
          toNode: target.id,
          kind,
        });
        return `Linked "${fieldsOf(source).title}" ${kind} "${fieldsOf(target).title}".`;
      }),
  );

  server.registerTool(
    "run_card",
    {
      description:
        "Run a python or lean card and read its output. Runs in a stripped environment.",
      inputSchema: { id: cardRef },
    },
    ({ id }) =>
      guardResult(async () => {
        const { card } = await find(id);

        if (!RUNNABLE_KINDS.has(card.kind)) {
          throw new ToolRefusal(`A ${card.kind} card cannot be run.`);
        }

        const row = await db.query.canvasNode.findFirst({
          where: { id: card.id },
        });
        const updated = await runCardNode(db, row!, {
          workspaceDir,
          toolchain,
          isolated: true,
        });

        if (!updated) {
          throw new ToolRefusal("The card was deleted while it ran.");
        }

        return runResult(
          toCanvasNode(updated),
          figuresDir(workspaceDir, card.id),
        );
      }),
  );

  server.registerTool(
    "remember",
    {
      description: [
        `Save up to ${MAX_MEMORY_ENTRIES} notes for later sessions on this project, each one sentence (at most ${MAX_MEMORY_CHARS} characters). They are shown to every later run.`,
        "Record only what would change what a later session does: a fact that was established or checked, a dead end with the reason it fails, or an idea worth trying that you did not get to. Never record chat summaries, progress updates or what is already on a card. Repeats are ignored.",
        "kinds: fact, dead-end, idea.",
      ].join(" "),
      inputSchema: {
        entries: z.array(
          z.object({ kind: z.enum(MEMORY_KINDS), text: z.string() }),
        ),
      },
    },
    ({ entries }) =>
      guard(async () => {
        if (entries.length === 0 || entries.length > MAX_MEMORY_ENTRIES) {
          throw new ToolRefusal(
            `Send between 1 and ${MAX_MEMORY_ENTRIES} entries.`,
          );
        }

        const tooLong = entries.find(
          (e) => e.text.trim().length > MAX_MEMORY_CHARS,
        );
        if (tooLong) {
          throw new ToolRefusal(
            `Keep each entry to one sentence of at most ${MAX_MEMORY_CHARS} characters ("${tooLong.text.trim().slice(0, 40)}..." is ${tooLong.text.trim().length}).`,
          );
        }

        const canvas = await db.query.canvas.findFirst({
          where: { id: run.canvasId },
        });
        const saved = await addMemory(db, canvas!.projectId, entries, {
          canvasId: run.canvasId,
          attemptId: run.attemptId,
        });

        run.memorySaved = (run.memorySaved ?? 0) + saved.length;
        return `Saved ${saved.length} new of ${entries.length} entries.`;
      }),
  );

  server.registerTool(
    "search_literature",
    {
      description: [
        `Search arXiv; returns up to ${MAX_RESULTS} papers (id, title, authors, date, abstract), most relevant first.`,
        'Plain words are all required; quote phrases ("rich lines"). arXiv syntax also works: ti:, abs:, au:, cat:math.CO, AND, OR, ANDNOT.',
        "Requests are spaced 3 seconds apart, so prefer a few precise queries.",
      ].join(" "),
      inputSchema: {
        query: z.string().min(1),
        max: z.number().int().min(1).max(MAX_RESULTS).optional(),
      },
    },
    ({ query, max }) =>
      guard(async () => {
        const papers = await arxiv.search(query, max ?? 10);
        run.papers ??= new Map();

        for (const paper of papers) {
          run.papers.set(paper.id, paper);
        }
        if (papers.length === 0) {
          return `No papers match "${query}". Try fewer or broader words.`;
        }
        return [
          `${papers.length} papers for "${query}":`,
          ...papers.map(describePaper),
        ].join("\n");
      }),
  );

  server.registerTool(
    "record_literature",
    {
      description: [
        "Write the result of a literature check on a literature card: verdict, a short markdown summary, suggestions, and the papers that matter with one sentence each on why.",
        `verdicts: ${LITERATURE_VERDICTS.join(", ")}. At most ${MAX_PAPERS} papers and ${MAX_SUGGESTIONS} suggestions. Paper ids are arXiv ids from search_literature. Calling it again replaces the earlier result. Wrap every formula in $...$ in the summary, suggestions and relevance (e.g. $t_2 \\ge 3 + \\sum_{r\\ge 4}(r-3)t_r$); bare math will not render.`,
      ].join(" "),
      inputSchema: {
        card: cardRef,
        verdict: z.enum(LITERATURE_VERDICTS),
        summary: z
          .string()
          .min(1)
          .describe("Short markdown; every formula wrapped in $...$"),
        suggestions: z.array(z.string()).optional(),
        papers: z.array(
          z.object({ id: z.string(), relevance: z.string().min(1) }),
        ),
        queries: z.array(z.string()).optional(),
      },
    },
    (record) =>
      guard(async () => {
        const card = await recordLiterature(db, arxiv, run, record);
        return `Recorded ${record.verdict} with ${record.papers.length} papers on [${card.id}] "${fieldsOf(card).title}".`;
      }),
  );

  server.registerTool(
    "archive_cards",
    {
      description: [
        `Hide up to ${MAX_ARCHIVE} cards from the canvas (the user can restore them): dead ends, notes merged into a summary, superseded checks.`,
        "Refused for the goal, open or supported hypotheses, user cards, and cards linked to a supported hypothesis.",
      ].join(" "),
      inputSchema: {
        ids: z.array(cardRef).min(1).max(MAX_ARCHIVE),
        reason: z
          .string()
          .min(1)
          .describe('Short, such as "merged into H2 summary"'),
      },
    },
    ({ ids, reason }) =>
      guard(async () => {
        if (!ARCHIVERS.has(run.author.role)) {
          throw new ToolRefusal(
            "Only a tidy run archives cards. Leave them and say what should go.",
          );
        }

        const { archived, refused } = await archiveCards(db, run, ids, reason);

        return [
          `Archived ${archived.length} card${archived.length === 1 ? "" : "s"}.`,
          refused.length > 0 && `Kept: ${refused.join("; ")}.`,
        ]
          .filter(Boolean)
          .join(" ");
      }),
  );
}
