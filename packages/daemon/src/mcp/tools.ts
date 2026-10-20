import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { addEdge, addMemory, EDGE_KINDS, MEMORY_KINDS, type Db } from "core";
import type { CanvasNode, CardRun, Toolchain } from "shared";
import { z } from "zod";
import {
  CREATABLE_KINDS,
  createCards,
  MAX_NEW_CARDS,
  updateCard,
} from "../cards/apply.js";
import { describeCanvas, describeOne } from "../cards/describe.js";
import { findCard } from "../cards/find.js";
import { goalNudge } from "../cards/goal.js";
import { loadDetail, toCanvasNode } from "../cards/load.js";
import { fieldsOf, ToolRefusal, type RunContext } from "../cards/types.js";
import { RUNNABLE_KINDS, runCardNode } from "../runCard.js";

export type ToolDeps = {
  db: Db;
  workspaceDir: string;
  toolchain: Promise<Toolchain>;
};

const text = (value: string): CallToolResult => ({
  content: [{ type: "text", text: value }],
});

async function guard(work: () => Promise<string>): Promise<CallToolResult> {
  try {
    return text(await work());
  } catch (error) {
    const message =
      error instanceof ToolRefusal || error instanceof Error
        ? error.message
        : String(error);
    return { ...text(message), isError: true };
  }
}

const cardRef = z
  .string()
  .describe(
    'Card id, "goal", a hypothesis label such as H2, or an exact title',
  );

const cardFields = {
  title: z.string().optional(),
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

function describeRun(card: CanvasNode) {
  const run = (card.payload as { run?: CardRun }).run;

  if (!run) {
    return "No result.";
  }

  return [
    `Result: ${run.badge} (${run.ok ? "passed" : "not passed"})`,
    run.output.stdout.trim() && `stdout:\n${run.output.stdout}`,
    run.output.stderr.trim() && `stderr:\n${run.output.stderr}`,
    run.diagnostics?.length &&
      `diagnostics:\n${run.diagnostics.map((d) => `${d.line}:${d.column} ${d.severity}: ${d.message}`).join("\n")}`,
    run.axioms?.length && `axioms: ${run.axioms.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const MAX_MEMORY_ENTRIES = 3;
export const MAX_MEMORY_CHARS = 300;

export function registerTools(
  server: McpServer,
  run: RunContext,
  { db, workspaceDir, toolchain }: ToolDeps,
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
        const nudge = goalNudge(await detail());

        return [`Updated [${card.id}] "${fieldsOf(card).title}".`, nudge]
          .filter(Boolean)
          .join("\n");
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
      guard(async () => {
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

        return describeRun(toCanvasNode(updated!));
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
            `Keep each entry to one sentence of at most ${MAX_MEMORY_CHARS} characters ("${tooLong.text.trim().slice(0, 40)}…" is ${tooLong.text.trim().length}).`,
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
}
