import { listMemory, type Db, type MemoryEntry } from "core";

const HEADER = "Research memory for this project:";

const line = (entry: MemoryEntry) =>
  `- [${entry.kind}] ${entry.text.replace(/\s+/g, " ")}`;

export async function memoryPreamble(
  db: Db,
  projectId: string,
  budget = 3000,
): Promise<string> {
  const entries = (await listMemory(db, { projectId })).sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.createdAt.localeCompare(a.createdAt) ||
      b.id.localeCompare(a.id),
  );
  const lines = [HEADER];
  let length = HEADER.length;

  for (const entry of entries) {
    const next = line(entry);

    if (length + 1 + next.length > budget) {
      break;
    }
    lines.push(next);
    length += 1 + next.length;
  }

  return lines.length > 1 ? lines.join("\n") : "";
}
