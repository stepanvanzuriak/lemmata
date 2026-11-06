import { z } from "zod";
import { MAX_PROGRESS_ITEMS, setProgress } from "../../cards/progress.js";
import { fieldsOf } from "../../cards/types.js";
import { cardRef, guard, type RegisterTool } from "./shared.js";

const line = z.string().trim().min(1).max(600);

export const registerUpdateProgress: RegisterTool = (server, { db, run }) => {
  server.registerTool(
    "update_progress",
    {
      description: [
        "Record where work on a hypothesis or attack stands. It replaces the card's whole progress record, which the canvas shows as its own section, so send the full current state, not just what changed.",
        "established: results proved toward the card, each citing the cards that establish it (evidence: ids or labels of passing python or lean checks, supported hypotheses, worked attacks or paper cards). A step without such evidence belongs in remaining.",
        "remaining: the exact open steps. next: the first step the next run should take.",
        "Update it at the end of every run on an open attack or hypothesis. A new established item is what counts as progress for the attack's run budget.",
      ].join(" "),
      inputSchema: {
        id: cardRef,
        established: z
          .array(
            z.object({
              text: line,
              evidence: z.array(z.string().trim().min(1)).min(1).max(8),
            }),
          )
          .max(MAX_PROGRESS_ITEMS),
        remaining: z.array(line).max(MAX_PROGRESS_ITEMS),
        next: z.string().trim().max(600).optional(),
      },
    },
    ({ id, ...input }) =>
      guard(async () => {
        const { card, advanced, restored } = await setProgress(
          db,
          run,
          id,
          input,
        );
        const { label, title } = fieldsOf(card);

        return [
          `Recorded progress on ${label ?? `"${title}"`}: ${input.established.length} established, ${input.remaining.length} remaining.`,
          advanced
            ? "A new established result: the run budget restarts."
            : "No new established result since the last update.",
          restored &&
            "The card was archived; it is restored and visible again.",
        ]
          .filter(Boolean)
          .join("\n");
      }),
  );
};
