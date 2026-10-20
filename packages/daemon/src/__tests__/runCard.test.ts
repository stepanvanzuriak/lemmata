import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  MIGRATIONS_FOLDER,
  addNode,
  createCanvas,
  createProject,
  openDb,
  parsePayload,
  type CanvasNode,
  type Db,
} from "core";
import { figuresDir, pruneFigures, runCardNode } from "../runCard.js";
import { STUB_PYPLOT } from "./helpers/matplotlib.js";

async function fixture(db: Db) {
  const project = await createProject(db, {
    title: "P",
    dir: await mkdtemp(join(tmpdir(), "lemmata-p-")),
  });
  return (await createCanvas(db, project.id)).id;
}

const runOf = (node: CanvasNode) =>
  parsePayload(node.payload).run as {
    ok: boolean;
    badge: string;
    figures: unknown[];
  };

async function setup() {
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  const workspaceDir = await mkdtemp(join(tmpdir(), "lemmata-ws-"));
  return { db, workspaceDir };
}

it("keeps figures from a card that plots and then raises, and clears them next run", async () => {
  const { db, workspaceDir } = await setup();
  const canvas = await fixture(db);
  const options = {
    workspaceDir,
    toolchain: Promise.resolve({
      claude: null,
      uv: null,
      python: "Python 3",
      lean: null,
    }),
    isolated: false,
  };
  const node = await addNode(db, {
    canvasId: canvas,
    kind: "python",
    payload: {
      kind: "python",
      title: "plot",
      source: `${STUB_PYPLOT}\nplt._plot(1)\nplt._plot(2)\nraise ValueError("x")`,
    },
    x: 0,
    y: 0,
    w: 100,
    h: 100,
  });

  const first = await runCardNode(db, node, options);
  const run = runOf(first!);

  expect(run.ok).toBe(false);
  expect(run.figures).toHaveLength(2);
  expect(run.badge).toContain("2 figures");
  expect(await readdir(figuresDir(workspaceDir, node.id))).toContain(
    "fig-2.png",
  );

  const quiet = await addNode(db, {
    canvasId: canvas,
    kind: "python",
    payload: { kind: "python", title: "quiet", source: "print(1)" },
    x: 0,
    y: 0,
    w: 100,
    h: 100,
  });
  await mkdir(figuresDir(workspaceDir, quiet.id), { recursive: true });
  await writeFile(join(figuresDir(workspaceDir, quiet.id), "fig-9.png"), "old");

  const again = await runCardNode(db, quiet, options);
  const rerun = runOf(again!);

  expect(rerun.figures).toEqual([]);
  expect(await readdir(figuresDir(workspaceDir, quiet.id))).toEqual([]);
});

it("prunes figure folders of nodes that no longer exist", async () => {
  const { db, workspaceDir } = await setup();
  const canvas = await fixture(db);
  const live = await addNode(db, {
    canvasId: canvas,
    kind: "note",
    payload: { kind: "note", title: "n" },
    x: 0,
    y: 0,
    w: 100,
    h: 100,
  });

  await mkdir(figuresDir(workspaceDir, live.id), { recursive: true });
  await mkdir(figuresDir(workspaceDir, "ghost"), { recursive: true });
  await pruneFigures(db, workspaceDir);

  expect(await readdir(join(workspaceDir, ".lemmata", "figures"))).toEqual([
    live.id,
  ]);
});

it("ignores figure names a card writes into figures.json", async () => {
  const { db, workspaceDir } = await setup();
  const canvas = await fixture(db);
  const node = await addNode(db, {
    canvasId: canvas,
    kind: "python",
    payload: {
      kind: "python",
      title: "sneaky",
      source: [
        "import sys, json",
        "f = sys._getframe()",
        'while "outdir" not in f.f_globals: f = f.f_back',
        'outdir = f.f_globals["outdir"]',
        'bad = [{"name": "../../secret.png", "title": None, "is3d": False, "views": None},',
        '       {"name": "fig-1.png", "title": None, "is3d": True, "views": "../x.png"},',
        '       {"name": "fig-2.png", "title": None, "is3d": False, "views": None}]',
        'json.dump(bad, open(outdir + "/figures.json", "w"))',
      ].join("\n"),
    },
    x: 0,
    y: 0,
    w: 100,
    h: 100,
  });
  const done = await runCardNode(db, node, {
    workspaceDir,
    toolchain: Promise.resolve({
      claude: null,
      uv: null,
      python: "Python 3",
      lean: null,
    }),
    isolated: false,
  });

  expect(runOf(done!).figures).toEqual([
    { name: "fig-2.png", title: null, is3d: false, views: null },
  ]);
});

it("runs one card's runs one after another", async () => {
  const { db, workspaceDir } = await setup();
  const canvas = await fixture(db);
  const node = await addNode(db, {
    canvasId: canvas,
    kind: "python",
    payload: {
      kind: "python",
      title: "plot",
      source: `${STUB_PYPLOT}\nplt._plot(1)`,
    },
    x: 0,
    y: 0,
    w: 100,
    h: 100,
  });
  const options = {
    workspaceDir,
    toolchain: Promise.resolve({
      claude: null,
      uv: null,
      python: "Python 3",
      lean: null,
    }),
    isolated: false,
  };
  const runs = await Promise.all([
    runCardNode(db, node, options),
    runCardNode(db, node, options),
    runCardNode(db, node, options),
  ]);

  expect(runs.map((r) => runOf(r!).figures.length)).toEqual([1, 1, 1]);
  expect(await readdir(figuresDir(workspaceDir, node.id))).toContain(
    "fig-1.png",
  );
});
