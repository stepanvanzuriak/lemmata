import type { Db } from "./db/index.js";
import { attemptEvent } from "./db/schema.js";

export async function addAttemptEvent(
  db: Db,
  attemptId: string,
  kind: string,
  data: unknown,
) {
  await db
    .insert(attemptEvent)
    .values({ attemptId, kind, data: JSON.stringify(data) ?? "null" });
}

export async function listAttemptEvents(
  db: Db,
  attemptId: string,
  after = 0,
  limit = 200,
) {
  const rows = await db.query.attemptEvent.findMany({
    where: { attemptId, id: { gt: after } },
    orderBy: { id: "asc" },
    limit,
  });
  return rows.map((row) => ({ ...row, data: JSON.parse(row.data) as unknown }));
}
