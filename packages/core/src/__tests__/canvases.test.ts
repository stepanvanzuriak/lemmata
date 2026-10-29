import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../db/index.js";
import {
  addEdge,
  addNode,
  createCanvas,
  deleteEdge,
  deleteNode,
  getCanvas,
  GoalNodeError,
  listCanvases,
  updateNode,
  updateNodePositions,
  setNodeCollapsed,
} from "../canvases.js";
import { MIGRATIONS_FOLDER } from "../index.js";
import { createProject } from "../projects.js";

async function setup() {
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);
  const p = await createProject(db, {
    title: "Collatz",
    statement: "Every orbit reaches 1.",
  });
  const [c] = await listCanvases(db, p.id);
  const detail = (await getCanvas(db, c!.id))!;
  return { db, p, c: c!, goal: detail.nodes[0]! };
}

it("a new project has one canvas with a goal node from the statement", async () => {
  const { db, c, goal } = await setup();
  const detail = (await getCanvas(db, c.id))!;

  expect(detail.nodes).toHaveLength(1);
  expect(goal.kind).toBe("goal");
  expect(JSON.parse(goal.payload)).toEqual({
    title: "Collatz",
    text: "Every orbit reaches 1.",
    status: "open",
  });
  expect(await getCanvas(db, "missing")).toBeNull();
});

it("createCanvas adds a second canvas with its own goal", async () => {
  const { db, p } = await setup();
  const created = await createCanvas(db, p.id, "Attempt 2");

  expect(created.title).toBe("Attempt 2");
  expect(await listCanvases(db, p.id)).toHaveLength(2);
  expect((await getCanvas(db, created.id))!.nodes[0]!.kind).toBe("goal");
});

it("adds, merges, moves and deletes nodes", async () => {
  const { db, c, goal } = await setup();
  const n = await addNode(db, {
    canvasId: c.id,
    kind: "note",
    payload: { title: "T", text: "a" },
  });

  const merged = await updateNode(db, n.id, { text: "b", author: "me" });
  expect(JSON.parse(merged!.payload)).toEqual({
    title: "T",
    text: "b",
    author: "me",
  });
  expect(await updateNode(db, "missing", {})).toBeUndefined();

  await updateNodePositions(db, c.id, [
    { id: n.id, x: 10, y: 20, w: 30, h: 40 },
    { id: goal.id, x: 1, y: 2 },
  ]);
  const nodes = (await getCanvas(db, c.id))!.nodes;
  expect(nodes.find((x) => x.id === n.id)).toMatchObject({
    x: 10,
    y: 20,
    w: 30,
    h: 40,
    updatedAt: merged!.updatedAt,
  });

  await deleteNode(db, n.id);
  expect((await getCanvas(db, c.id))!.nodes).toHaveLength(1);
});

it("refuses to delete the goal node", async () => {
  const { db, goal } = await setup();
  await expect(deleteNode(db, goal.id)).rejects.toBeInstanceOf(GoalNodeError);
});

it("persists collapsed cards across database reopen without changing content or hiding children", async () => {
  const folder = await mkdtemp(join(tmpdir(), "lemmata-collapse-"));
  const url = `file:${join(folder, "workspace.db")}`;
  let db = await openDb(url, MIGRATIONS_FOLDER);
  try {
    const project = await createProject(db, {
      title: "Goal",
      statement: "Prove it",
    });
    const [canvas] = await listCanvases(db, project.id);
    const goal = (await getCanvas(db, canvas!.id))!.nodes[0]!;
    const child = await addNode(db, {
      canvasId: canvas!.id,
      kind: "hypothesis",
      payload: { title: "Child" },
    });
    await addEdge(db, {
      canvasId: canvas!.id,
      fromNode: goal.id,
      toNode: child.id,
      kind: "depends-on",
    });
    expect(goal.collapsed).toBe(false);
    await setNodeCollapsed(db, goal.id, true);
    await setNodeCollapsed(db, child.id, true);
    db.$client.close();
    db = await openDb(url, MIGRATIONS_FOLDER);
    const loaded = (await getCanvas(db, canvas!.id))!;
    expect(loaded.nodes).toHaveLength(2);
    expect(loaded.edges).toHaveLength(1);
    expect(loaded.nodes.find(({ id }) => id === goal.id)).toMatchObject({
      collapsed: true,
      payload: goal.payload,
      updatedAt: goal.updatedAt,
    });
    expect(loaded.nodes.find(({ id }) => id === child.id)?.collapsed).toBe(
      true,
    );
    await updateNode(db, goal.id, { text: "Updated by an agent" });
    expect(
      (await getCanvas(db, canvas!.id))!.nodes.find(({ id }) => id === goal.id)
        ?.collapsed,
    ).toBe(true);
    await setNodeCollapsed(db, goal.id, false);
    expect(
      (await getCanvas(db, canvas!.id))!.nodes.find(({ id }) => id === goal.id)
        ?.collapsed,
    ).toBe(false);
    expect(await setNodeCollapsed(db, "missing", true)).toBeUndefined();
  } finally {
    db.$client.close();
    await rm(folder, { recursive: true, force: true });
  }
});

it("does not insert a duplicate edge", async () => {
  const { db, c, goal } = await setup();
  const n = await addNode(db, { canvasId: c.id, kind: "note" });
  const input = {
    canvasId: c.id,
    fromNode: goal.id,
    toNode: n.id,
    kind: "depends-on",
  } as const;

  const first = await addEdge(db, input);
  const second = await addEdge(db, input);

  expect(second.id).toBe(first.id);
  expect((await getCanvas(db, c.id))!.edges).toHaveLength(1);

  await deleteEdge(db, first.id);
  expect((await getCanvas(db, c.id))!.edges).toHaveLength(0);
});

it("deleting a node removes its edges", async () => {
  const { db, c, goal } = await setup();
  const n = await addNode(db, { canvasId: c.id, kind: "note" });
  await addEdge(db, {
    canvasId: c.id,
    fromNode: goal.id,
    toNode: n.id,
    kind: "checked-by",
  });

  await deleteNode(db, n.id);
  expect((await getCanvas(db, c.id))!.edges).toHaveLength(0);
});
