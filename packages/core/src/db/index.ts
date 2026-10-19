import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { relations } from "./relations.js";
import * as schema from "./schema.js";

export type Db = Awaited<ReturnType<typeof openDb>>;

export async function openDb(url: string, migrationsFolder: string) {
  const client = createClient({ url });

  await client.execute("PRAGMA foreign_keys = ON");

  if (url !== ":memory:") {
    await client.execute("PRAGMA journal_mode = WAL");
  }

  const db = drizzle({ client, relations });
  await migrate(db, { migrationsFolder });

  return db;
}

export { relations, schema };
