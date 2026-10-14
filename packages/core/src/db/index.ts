import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema.js";

export type Db = Awaited<ReturnType<typeof openDb>>;

/** Opens (or creates) the database, applies pragmas and runs pending migrations. `url` is e.g. `file:/path/db` or `:memory:`. */
export async function openDb(url: string, migrationsFolder: string) {
  const client = createClient({ url });
  // Pragmas are per connection and not applied by Drizzle.
  await client.execute("PRAGMA foreign_keys = ON");
  if (url !== ":memory:") await client.execute("PRAGMA journal_mode = WAL");
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder });
  return db;
}

export { schema };
