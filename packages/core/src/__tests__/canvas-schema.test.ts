import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { openDb } from "../db/index.js";
import { canvas, canvasEdge, canvasNode, project } from "../db/schema.js";
import { MIGRATIONS_FOLDER } from "../index.js";

it("deleting a project removes its canvases, nodes and edges", async () => {
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);

  const [p] = await db.insert(project).values({ title: "P" }).returning();
  const [c] = await db
    .insert(canvas)
    .values({ projectId: p.id, title: "C" })
    .returning();
  const [a, b] = await db
    .insert(canvasNode)
    .values([
      { canvasId: c.id, kind: "goal" },
      { canvasId: c.id, kind: "note" },
    ])
    .returning();
  await db.insert(canvasEdge).values({
    canvasId: c.id,
    fromNode: a.id,
    toNode: b.id,
    kind: "depends-on",
  });

  await db.delete(project).where(eq(project.id, p.id));

  expect(await db.select().from(canvas)).toEqual([]);
  expect(await db.select().from(canvasNode)).toEqual([]);
  expect(await db.select().from(canvasEdge)).toEqual([]);
});

it("loads a canvas with its nodes and edges through relations", async () => {
  const db = await openDb(":memory:", MIGRATIONS_FOLDER);

  const [p] = await db.insert(project).values({ title: "P" }).returning();
  const [c] = await db.insert(canvas).values({ projectId: p.id }).returning();
  const [a, b] = await db
    .insert(canvasNode)
    .values([
      { canvasId: c.id, kind: "goal" },
      { canvasId: c.id, kind: "note" },
    ])
    .returning();
  await db
    .insert(canvasEdge)
    .values({ canvasId: c.id, fromNode: a.id, toNode: b.id, kind: "used-by" });

  const found = await db.query.canvas.findFirst({
    where: { id: c.id },
    with: { nodes: true, edges: true },
  });

  expect(found?.nodes).toHaveLength(2);
  expect(found?.edges).toHaveLength(1);
});
