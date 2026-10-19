import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  isoNow,
  parsePayload,
  updateNode,
  type CanvasNode,
  type Db,
} from "core";
import type { CardRun, RunOutput, Toolchain } from "shared";
import { runLean, runPython, type LeanReport } from "./exec.js";
import { pythonCommand } from "./toolchain.js";

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

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

function pythonBadge(output: RunOutput) {
  if (output.timedOut) {
    return "Timed out";
  }
  if (output.exitCode === 0) {
    return `Passed · ${seconds(output.durationMs)}`;
  }

  return `Exit ${output.exitCode}`;
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
  { toolchain, isolated }: RunCardOptions,
): Promise<CardRun> {
  const output = await runPython(source, pythonCommand(await toolchain), {
    cwd,
    isolated,
  });

  return {
    ok: !output.timedOut && output.exitCode === 0,
    output,
    badge: pythonBadge(output),
    runAt: isoNow(),
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

export async function runCardNode(
  db: Db,
  node: CanvasNode,
  options: RunCardOptions,
): Promise<CanvasNode | undefined> {
  const source = String(parsePayload(node.payload).source ?? "");
  const cwd = await projectDir(db, node.canvasId, options.workspaceDir);
  const run =
    node.kind === "python"
      ? await runPythonCard(source, cwd, options)
      : await runLeanCard(source, cwd, options);

  return updateNode(db, node.id, { run });
}
