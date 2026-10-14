import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { openDb } from "./db/index.js";

export async function initWorkspace(dir: string, migrationsFolder: string) {
  const root = resolve(dir);
  const data = join(root, ".lemmata");

  await mkdir(data, { recursive: true });

  return openDb(`file:${join(data, "lemmata.db")}`, migrationsFolder);
}
