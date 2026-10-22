import { addMemory, MEMORY_KINDS } from "core";
import { z } from "zod";
import { ToolRefusal } from "../../cards/types.js";
import { guard, type RegisterTool } from "./shared.js";

export const MAX_MEMORY_ENTRIES = 3;
export const MAX_MEMORY_CHARS = 300;

export const registerRemember: RegisterTool = (server, { db, run }) => {
  server.registerTool(
    "remember",
    {
      description: [
        `Save up to ${MAX_MEMORY_ENTRIES} notes for later sessions on this project, each one sentence (at most ${MAX_MEMORY_CHARS} characters). They are shown to every later run.`,
        "Record only what would change what a later session does: a fact that was established or checked, a dead end with the reason it fails, or an idea worth trying that you did not get to. Never record chat summaries, progress updates or what is already on a card. Repeats are ignored.",
        "kinds: fact, dead-end, idea.",
      ].join(" "),
      inputSchema: {
        entries: z.array(
          z.object({ kind: z.enum(MEMORY_KINDS), text: z.string() }),
        ),
      },
    },
    ({ entries }) =>
      guard(async () => {
        if (entries.length === 0 || entries.length > MAX_MEMORY_ENTRIES) {
          throw new ToolRefusal(
            `Send between 1 and ${MAX_MEMORY_ENTRIES} entries.`,
          );
        }

        const tooLong = entries.find(
          (e) => e.text.trim().length > MAX_MEMORY_CHARS,
        );
        if (tooLong) {
          throw new ToolRefusal(
            `Keep each entry to one sentence of at most ${MAX_MEMORY_CHARS} characters ("${tooLong.text.trim().slice(0, 40)}..." is ${tooLong.text.trim().length}).`,
          );
        }

        const canvas = await db.query.canvas.findFirst({
          where: { id: run.canvasId },
        });
        const saved = await addMemory(db, canvas!.projectId, entries, {
          canvasId: run.canvasId,
          attemptId: run.attemptId,
        });

        run.memorySaved = (run.memorySaved ?? 0) + saved.length;
        return `Saved ${saved.length} new of ${entries.length} entries.`;
      }),
  );
};
