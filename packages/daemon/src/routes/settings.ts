import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Hono } from "hono";
import type { Settings } from "shared";
import { z } from "zod";
import { validate } from "../validate.js";
import { ADAPTERS, type AdapterName } from "runner";

const DEFAULTS: Settings = {
  onboarded: false,
  agent: "claude",
  providers: { claude: true, codex: false },
};

const patchSchema = z.object({
  onboarded: z.boolean().optional(),
  providers: z.object({ claude: z.boolean(), codex: z.boolean() }).optional(),
  agent: z
    .enum(Object.keys(ADAPTERS) as [AdapterName, ...AdapterName[]])
    .optional(),
});

export async function readSettings(workspaceDir: string): Promise<Settings> {
  try {
    const saved = patchSchema.parse(
      JSON.parse(
        await readFile(join(workspaceDir, ".lemmata", "settings.json"), "utf8"),
      ),
    );
    return {
      ...DEFAULTS,
      ...saved,
      providers: saved.providers ?? {
        claude: (saved.agent ?? "claude") === "claude",
        codex: saved.agent === "codex",
      },
    };
  } catch {
    return DEFAULTS;
  }
}

export function settingsRoutes(workspaceDir: string) {
  const dir = join(workspaceDir, ".lemmata");
  const file = join(dir, "settings.json");

  return new Hono()
    .get("/", async (c) => c.json(await readSettings(workspaceDir)))
    .patch("/", validate("json", patchSchema), async (c) => {
      const next: Settings = {
        ...(await readSettings(workspaceDir)),
        ...c.req.valid("json"),
      };

      await mkdir(dir, { recursive: true });
      await writeFile(`${file}.tmp`, JSON.stringify(next, null, 2));
      await rename(`${file}.tmp`, file);

      return c.json(next, 200);
    });
}
