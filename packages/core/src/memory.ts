import { eq } from "drizzle-orm";
import type { Db } from "./db/index.js";
import { memoryEntry, type MemoryEntry, type MemoryKind } from "./db/schema.js";
import { isoNow } from "./ids.js";

export type MemoryInput = { kind: MemoryKind; text: string };

export type MemorySource = {
  canvasId?: string | null;
  attemptId?: string | null;
};

export async function addMemory(
  db: Db,
  projectId: string,
  entries: MemoryInput[],
  source: MemorySource = {},
): Promise<MemoryEntry[]> {
  const now = isoNow();
  const values = entries
    .map((entry) => ({ ...entry, text: entry.text.trim() }))
    .filter((entry) => entry.text !== "")
    .map((entry) => ({
      ...entry,
      projectId,
      canvasId: source.canvasId ?? null,
      attemptId: source.attemptId ?? null,
      createdAt: now,
      updatedAt: now,
    }));

  if (values.length === 0) {
    return [];
  }

  return db
    .insert(memoryEntry)
    .values(values)
    .onConflictDoNothing()
    .returning();
}

export function listMemory(
  db: Db,
  { projectId, kind }: { projectId?: string; kind?: MemoryKind } = {},
): Promise<MemoryEntry[]> {
  return db.query.memoryEntry.findMany({
    where: { projectId, kind },
    orderBy: { createdAt: "asc", id: "asc" },
  });
}

export function getMemory(
  db: Db,
  id: string,
): Promise<MemoryEntry | undefined> {
  return db.query.memoryEntry.findFirst({ where: { id } });
}

export async function updateMemory(
  db: Db,
  id: string,
  patch: Partial<Pick<MemoryEntry, "kind" | "text" | "pinned">>,
): Promise<MemoryEntry | undefined> {
  const [row] = await db
    .update(memoryEntry)
    .set({
      kind: patch.kind,
      text: patch.text?.trim(),
      pinned: patch.pinned,
      updatedAt: isoNow(),
    })
    .where(eq(memoryEntry.id, id))
    .returning();

  return row;
}

export async function deleteMemory(db: Db, id: string): Promise<boolean> {
  const rows = await db
    .delete(memoryEntry)
    .where(eq(memoryEntry.id, id))
    .returning({ id: memoryEntry.id });

  return rows.length > 0;
}
