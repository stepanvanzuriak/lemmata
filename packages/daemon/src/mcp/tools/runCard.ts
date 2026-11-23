import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { CardFigure, CardRun } from "shared";
import { toCanvasNode } from "../../cards/load.js";
import { ToolRefusal } from "../../cards/types.js";
import { figuresDir, RUNNABLE_KINDS, runCardNode } from "../../runCard.js";
import { cardRef, guardResult, type RegisterTool } from "./shared.js";

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 1024 * 1024;

type Picture = { figure: CardFigure; file: string };

function picturesOf(figures: CardFigure[]): Picture[] {
  return figures.slice(0, MAX_IMAGES).map((figure) => ({
    figure,
    file: figure.is3d && figure.views ? figure.views : figure.name,
  }));
}

function describeRun(
  run: CardRun | undefined,
  attached: Set<string>,
  notes: string[],
) {
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
    run.output.stopped
      ? "The run was stopped. stdout above is what it printed before; a python card's stderr shows the stack where it stopped."
      : run.output.timedOut &&
        `The run timed out after ${Math.round(run.output.durationMs / 1000)} s. stdout above is what it printed before; a python card's stderr shows the stack where it was killed. Print progress as you go, or make the card cheaper.`,
    notes.length && notes.join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function runResult(
  run: CardRun | undefined,
  dir: string,
  extraNotes: string[] = [],
): Promise<CallToolResult> {
  const images: CallToolResult["content"] = [];
  const attached = new Set<string>();
  const notes: string[] = [...extraNotes];

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
      { type: "text", text: describeRun(run, attached, notes) },
      ...images,
    ],
  };
}

export const registerRunCard: RegisterTool = (
  server,
  { db, workspaceDir, toolchain, find },
) => {
  server.registerTool(
    "run_card",
    {
      description:
        "Run a python or lean card and read its output. Runs in a stripped environment. Python runs stop after 10 minutes, Lean after 20; stop_card ends a run early.",
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
          (toCanvasNode(updated).payload as { run?: CardRun }).run,
          figuresDir(workspaceDir, card.id),
        );
      }),
  );
};
