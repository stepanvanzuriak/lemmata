import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  isoNow,
  parsePayload,
  updateNode,
  type CanvasNode,
  type Db,
} from "core";
import type { CardFigure, CardRun, RunOutput, Toolchain } from "shared";
import { runLean, runPython, type LeanReport } from "./exec.js";
import { leanCommand, pythonCommand } from "./toolchain.js";

export const RUNNABLE_KINDS = new Set(["python", "lean"]);

export type RunCardOptions = {
  workspaceDir: string;
  toolchain: Promise<Toolchain>;
  isolated: boolean;
};

export async function projectDir(
  db: Db,
  canvasId: string,
  workspaceDir: string,
) {
  const canvas = await db.query.canvas.findFirst({
    where: { id: canvasId },
    with: { project: true },
  });
  const dir =
    canvas?.project?.dir ??
    join(workspaceDir, "projects", canvas?.projectId ?? "unknown");

  await mkdir(dir, { recursive: true });
  return dir;
}

const figuresRoot = (workspaceDir: string) =>
  join(workspaceDir, ".lemmata", "figures");

export const figuresDir = (workspaceDir: string, nodeId: string) =>
  join(figuresRoot(workspaceDir), nodeId);

const FIGURE_FILE = /^fig-\d+(-views)?\.png$/;

const isFigure = (f: Partial<CardFigure>): f is CardFigure =>
  typeof f?.name === "string" &&
  FIGURE_FILE.test(f.name) &&
  (f.views == null ||
    (typeof f.views === "string" && FIGURE_FILE.test(f.views)));

/** figures.json is written by the card's process, so only plain figure file names are trusted. */
async function readFigures(dir: string): Promise<CardFigure[]> {
  try {
    const figures = JSON.parse(
      await readFile(join(dir, "figures.json"), "utf8"),
    );
    return Array.isArray(figures) ? figures.filter(isFigure) : [];
  } catch {
    return [];
  }
}

/** Deletes figure folders whose node no longer exists. */
export async function pruneFigures(db: Db, workspaceDir: string) {
  const root = figuresRoot(workspaceDir);
  const folders = await readdir(root).catch(() => [] as string[]);

  for (const id of folders) {
    const node = await db.query.canvasNode.findFirst({ where: { id } });

    if (!node) {
      await rm(join(root, id), { recursive: true, force: true });
    }
  }
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

function pythonBadge(output: RunOutput, figures: number) {
  const suffix =
    figures > 0 ? ` · ${figures} figure${figures > 1 ? "s" : ""}` : "";

  if (output.timedOut) {
    return `Timed out${suffix}`;
  }
  if (output.exitCode === 0) {
    return `Passed · ${seconds(output.durationMs)}${suffix}`;
  }

  return `Exit ${output.exitCode}${suffix}`;
}

function leanBadge(output: RunOutput, report: LeanReport, found: boolean) {
  const errors = report.diagnostics.filter((d) => d.severity === "error");

  if (!found) {
    return "Lean not found";
  }
  if (output.timedOut) {
    return "Timed out";
  }
  if (errors.length > 0) {
    return `${errors.length} error${errors.length > 1 ? "s" : ""}`;
  }
  if (report.hasSorry) {
    return "Has sorry";
  }
  if (report.extraAxioms.length > 0) {
    return "Extra axioms";
  }
  if (output.exitCode !== 0) {
    return `Exit ${output.exitCode}`;
  }

  return `Checked · ${seconds(output.durationMs)}`;
}

async function runPythonCard(
  source: string,
  cwd: string,
  nodeId: string,
  { toolchain, isolated, workspaceDir }: RunCardOptions,
): Promise<CardRun> {
  const outDir = figuresDir(workspaceDir, nodeId);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const output = await runPython(source, pythonCommand(await toolchain), {
    cwd,
    isolated,
    outDir,
  });
  const figures = await readFigures(outDir);

  return {
    ok: !output.timedOut && output.exitCode === 0,
    output,
    badge: pythonBadge(output, figures.length),
    runAt: isoNow(),
    figures,
  };
}

async function runLeanCard(
  source: string,
  cwd: string,
  { workspaceDir, isolated }: RunCardOptions,
): Promise<CardRun> {
  const { output, report, found } = await runLean(
    source,
    join(workspaceDir, ".lemmata", "lean"),
    { cwd, isolated },
    leanCommand(),
  );
  const ok =
    found &&
    !output.timedOut &&
    output.exitCode === 0 &&
    !report.diagnostics.some((d) => d.severity === "error") &&
    !report.hasSorry &&
    report.extraAxioms.length === 0;

  return {
    ok,
    output,
    badge: leanBadge(output, report, found),
    runAt: isoNow(),
    ...report,
  };
}

async function runCardNodeNow(
  db: Db,
  node: CanvasNode,
  options: RunCardOptions,
): Promise<CanvasNode | undefined> {
  const source = String(parsePayload(node.payload).source ?? "");
  const cwd = await projectDir(db, node.canvasId, options.workspaceDir);
  const run =
    node.kind === "python"
      ? await runPythonCard(source, cwd, node.id, options)
      : await runLeanCard(source, cwd, options);

  return updateNode(db, node.id, { run });
}

const queues = new Map<string, Promise<unknown>>();

/** Runs of one card go one after another: they share a figures folder that each run empties first. */
export function runCardNode(
  db: Db,
  node: CanvasNode,
  options: RunCardOptions,
): Promise<CanvasNode | undefined> {
  const previous = queues.get(node.id) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(() => runCardNodeNow(db, node, options));
  const tail = next.catch(() => {});

  queues.set(node.id, tail);
  tail.then(() => {
    if (queues.get(node.id) === tail) {
      queues.delete(node.id);
    }
  });

  return next;
}
