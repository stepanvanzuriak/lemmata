import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { expect, it } from "vitest";
import {
  addAgent,
  addAttemptEvent,
  addEdge,
  addMemory,
  addMessage,
  addNode,
  createProject,
  listAttemptEvents,
  listCanvases,
  listMemory,
  listProjects,
  MIGRATIONS_FOLDER,
  openDb,
  startAttempt,
  type Db,
} from "core";
import { exportProject } from "../export.js";
import { ImportError, importProject } from "../import.js";
import { figuresDir } from "../runCard.js";

const tmp = (prefix: string) => mkdtemp(join(tmpdir(), prefix));

async function exported(db: Db, projectId: string, workspaceDir: string) {
  const archive = await exportProject(db, projectId, workspaceDir);
  return archive!.stream;
}

function bytes(data: Uint8Array): AsyncIterable<Uint8Array> {
  return (async function* () {
    // Small chunks, so entries straddle reads the way an upload does.
    for (let i = 0; i < data.length; i += 1000) {
      yield data.subarray(i, i + 1000);
    }
  })();
}

async function seed(db: Db, workspaceDir: string) {
  const project = await createProject(db, {
    title: "Collatz",
    statement: "3n+1",
  });
  const [canvas] = await listCanvases(db, project.id);
  const a = await addNode(db, {
    canvasId: canvas!.id,
    kind: "python",
    payload: { title: "plot", source: "" },
  });
  const agent = await addAgent(db, { canvasId: canvas!.id, role: "prover" });
  const b = await addNode(db, {
    canvasId: canvas!.id,
    kind: "hypothesis",
    payload: {
      title: "odd",
      evidence: [a.id],
      status: "claimed",
      claimedBy: agent.id,
    } as never,
  });

  await addEdge(db, {
    canvasId: canvas!.id,
    fromNode: a.id,
    toNode: b.id,
    kind: "depends-on",
  });

  const attempt = await startAttempt(db, {
    projectId: project.id,
    canvasId: canvas!.id,
    title: "run",
  });

  await addMessage(db, {
    canvasId: canvas!.id,
    role: "assistant",
    text: `see ${a.id}`,
    attemptId: attempt.id,
    agentId: agent.id,
    target: b.id,
    cards: [a.id, b.id],
  });

  for (let i = 0; i < 450; i++) {
    await addAttemptEvent(db, attempt.id, "tool", { i, card: a.id });
  }

  await addMemory(db, project.id, [{ kind: "fact", text: "n is odd" }], {
    canvasId: canvas!.id,
    attemptId: attempt.id,
  });

  const figures = figuresDir(workspaceDir, a.id);

  await mkdir(figures, { recursive: true });
  await writeFile(join(figures, "fig-1.png"), "png-bytes");

  return { project, canvas: canvas!, a, b, agent, attempt };
}

it("round-trips a project into a new folder with fresh, consistent ids", async () => {
  const workspaceDir = await tmp("lemmata-ws-");
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  const old = await seed(db, workspaceDir);
  const dir = join(await tmp("lemmata-dest-"), "Collatz copy");

  const project = await importProject(
    db,
    await exported(db, old.project.id, workspaceDir),
    { dir, workspaceDir },
  );

  expect(project).toMatchObject({ title: "Collatz", statement: "3n+1", dir });
  expect(project.id).not.toBe(old.project.id);
  expect(await readdir(dir)).toEqual([]);
  expect(await listProjects(db)).toHaveLength(2);

  const detail = await db.query.canvas.findMany({
    where: { projectId: project.id },
    with: { nodes: true, edges: true, agents: true, messages: true },
  });

  expect(detail).toHaveLength(1);
  const [canvas] = detail;
  const nodeIds = canvas!.nodes.map((n) => n.id);

  expect(nodeIds).not.toContain(old.a.id);

  const python = canvas!.nodes.find((n) => n.kind === "python")!;
  const hypothesis = canvas!.nodes.find((n) => n.kind === "hypothesis")!;
  const [agent] = canvas!.agents;

  // References inside payloads follow the new ids; the claim is released.
  expect(JSON.parse(hypothesis.payload)).toEqual({
    title: "odd",
    evidence: [python.id],
    status: "open",
  });
  expect(canvas!.edges).toMatchObject([
    { fromNode: python.id, toNode: hypothesis.id, kind: "depends-on" },
  ]);

  const [attempt] = await db.query.attempt.findMany({
    where: { projectId: project.id },
  });

  expect(attempt).toMatchObject({ canvasId: canvas!.id, status: "aborted" });
  expect(canvas!.messages).toMatchObject([
    {
      text: `see ${python.id}`,
      attemptId: attempt!.id,
      agentId: agent!.id,
      target: hypothesis.id,
      cards: [python.id, hypothesis.id],
    },
  ]);

  const events = await listAttemptEvents(db, attempt!.id, 0, 1000);

  expect(events).toHaveLength(450);
  expect(events.at(-1)!.data).toEqual({ i: 449, card: python.id });
  expect(await listMemory(db, { projectId: project.id })).toMatchObject([
    { text: "n is odd", canvasId: canvas!.id, attemptId: attempt!.id },
  ]);
  expect(
    await readFile(
      join(figuresDir(workspaceDir, python.id), "fig-1.png"),
      "utf8",
    ),
  ).toBe("png-bytes");

  // The original is untouched.
  expect(
    (await listAttemptEvents(db, old.attempt.id, 0, 1000)).at(-1)!.data,
  ).toEqual({ i: 449, card: old.a.id });
});

it("imports into an existing empty folder but not a non-empty one", async () => {
  const workspaceDir = await tmp("lemmata-ws-");
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  const old = await seed(db, workspaceDir);
  const empty = await tmp("lemmata-empty-");
  const full = await tmp("lemmata-full-");

  await writeFile(join(full, "x"), "");

  await expect(
    importProject(db, await exported(db, old.project.id, workspaceDir), {
      dir: full,
      workspaceDir,
    }),
  ).rejects.toThrow(/not empty/);
  await expect(
    importProject(db, await exported(db, old.project.id, workspaceDir), {
      dir: empty,
      workspaceDir,
    }),
  ).resolves.toMatchObject({ dir: empty });
});

it("removes everything it created when the archive is broken", async () => {
  const workspaceDir = await tmp("lemmata-ws-");
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  const parent = await tmp("lemmata-dest-");
  const dir = join(parent, "broken");
  const archive = zipSync({
    "manifest.json": strToU8(
      JSON.stringify({ format: "lemmata-project", version: 2 }),
    ),
    "project.json": strToU8(
      JSON.stringify({
        id: "01M5D5H8J3529VA6R62WSBTB71",
        title: "T",
        statement: "",
        dir: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    ),
    "canvases.json": strToU8("[{"),
  });

  await expect(
    importProject(db, bytes(archive), { dir, workspaceDir }),
  ).rejects.toThrow(ImportError);
  expect(await listProjects(db)).toEqual([]);
  expect(await readdir(parent)).toEqual([]);
});

it("rejects files that aren't .lemmata archives", async () => {
  const workspaceDir = await tmp("lemmata-ws-");
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  const dir = join(await tmp("lemmata-dest-"), "x");

  await expect(
    importProject(db, bytes(strToU8("hello")), { dir, workspaceDir }),
  ).rejects.toThrow(ImportError);
  await expect(
    importProject(
      db,
      bytes(zipSync({ "manifest.json": strToU8('{"format":"other"}') })),
      { dir, workspaceDir },
    ),
  ).rejects.toThrow(/format/);
  await expect(
    importProject(
      db,
      bytes(
        zipSync({
          "manifest.json": strToU8('{"format":"lemmata-project","version":99}'),
        }),
      ),
      { dir, workspaceDir },
    ),
  ).rejects.toThrow(/version 99/);
});

it("remaps hand-made ids that aren't ULIDs", async () => {
  const workspaceDir = await tmp("lemmata-ws-");
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  const old = await seed(db, workspaceDir);
  const odd = await addNode(db, {
    id: "01M64Q0000LINKBRANCHQUADRATIC",
    canvasId: old.canvas.id,
    kind: "hypothesis",
    payload: { title: "odd id", evidence: [old.a.id] } as never,
  });

  await addEdge(db, {
    canvasId: old.canvas.id,
    fromNode: odd.id,
    toNode: old.b.id,
    kind: "depends-on",
  });

  const project = await importProject(
    db,
    await exported(db, old.project.id, workspaceDir),
    { dir: join(await tmp("lemmata-dest-"), "copy"), workspaceDir },
  );
  const [canvas] = await db.query.canvas.findMany({
    where: { projectId: project.id },
    with: { nodes: true, edges: true },
  });
  const ids = canvas!.nodes.map((node) => node.id);

  expect(ids).toHaveLength(4); // goal, python, hypothesis, odd
  expect(ids).not.toContain(odd.id);
  expect(canvas!.edges).toHaveLength(2);
  canvas!.edges.forEach((edge) => {
    expect(ids).toContain(edge.fromNode);
    expect(ids).toContain(edge.toNode);
  });
});
