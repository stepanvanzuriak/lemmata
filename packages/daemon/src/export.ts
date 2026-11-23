import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { strToU8, zipSync, type Zippable } from "fflate";
import type { Db } from "core";
import { projectExportFileName } from "shared";
import { figuresDir } from "./runCard.js";

export const EXPORT_FORMAT = "lemmata-project";
export const EXPORT_VERSION = 1;

const FIGURE_NAME = /^fig-\d+(-views)?\.png$/;

const json = (value: unknown) => strToU8(`${JSON.stringify(value, null, 2)}\n`);

async function readNodeFigures(workspaceDir: string, nodeId: string) {
  const dir = figuresDir(workspaceDir, nodeId);
  const names = await readdir(dir).catch(() => [] as string[]);
  const files: Zippable = {};

  for (const name of names) {
    if (name === "figures.json" || FIGURE_NAME.test(name)) {
      const bytes = await readFile(join(dir, name)).catch(() => null);

      if (bytes) {
        files[name] = [new Uint8Array(bytes), { level: 0 }];
      }
    }
  }

  return files;
}

/**
 * Packs a project into a zip: its rows (canvases with their cards, links,
 * agents and chat; attempts with transcripts; memory) as JSON, plus each
 * card's figures. Returns null when the project doesn't exist.
 */
export async function exportProject(
  db: Db,
  projectId: string,
  workspaceDir: string,
) {
  const project = await db.query.project.findFirst({
    where: { id: projectId },
    with: {
      canvases: {
        with: { nodes: true, edges: true, agents: true, messages: true },
      },
      attempts: { with: { events: true } },
      memory: true,
    },
  });

  if (!project) {
    return null;
  }

  const { canvases, attempts, memory, ...row } = project;
  const figures: Zippable = {};

  for (const canvas of canvases) {
    for (const node of canvas.nodes) {
      const files = await readNodeFigures(workspaceDir, node.id);

      if (Object.keys(files).length) {
        figures[node.id] = files;
      }
    }
  }

  const archive: Zippable = {
    "manifest.json": json({
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
    }),
    "project.json": json(row),
    "canvases.json": json(canvases),
    "attempts.json": json(attempts),
    "memory.json": json(memory),
  };

  if (Object.keys(figures).length) {
    archive.figures = figures;
  }

  return {
    fileName: projectExportFileName(row.title),
    bytes: zipSync(archive, { level: 6 }),
  };
}
