import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Hono } from "hono";
import type { Settings } from "shared";
import { z } from "zod";
import { validate } from "../validate.js";

const DEFAULTS: Settings = { onboarded: false };

const patchSchema = z.object({ onboarded: z.boolean().optional() });

export function settingsRoutes(workspaceDir: string) {
  const dir = join(workspaceDir, ".lemmata");
  const file = join(dir, "settings.json");

  const read = async (): Promise<Settings> => {
    try {
      const saved = patchSchema.parse(JSON.parse(await readFile(file, "utf8")));
      return { ...DEFAULTS, ...saved };
    } catch {
      return DEFAULTS;
    }
  };

  return new Hono()
    .get("/", async (c) => c.json(await read()))
    .patch("/", validate("json", patchSchema), async (c) => {
      const next: Settings = { ...(await read()), ...c.req.valid("json") };

      await mkdir(dir, { recursive: true });
      await writeFile(`${file}.tmp`, JSON.stringify(next, null, 2));
      await rename(`${file}.tmp`, file);

      return c.json(next, 200);
    });
}
