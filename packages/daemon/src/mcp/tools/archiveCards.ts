import { z } from "zod";
import { archiveCards, MAX_ARCHIVE } from "../../cards/archive.js";
import { ToolRefusal } from "../../cards/types.js";
import { cardRef, guard, type RegisterTool } from "./shared.js";

const ARCHIVERS = new Set(["curator", "assistant"]);

export const registerArchiveCards: RegisterTool = (server, { db, run }) => {
  server.registerTool(
    "archive_cards",
    {
      description: [
        `Hide up to ${MAX_ARCHIVE} cards from the canvas: dead ends, notes merged into a summary, superseded checks.`,
        "Refused for the goal, open or supported hypotheses, user cards, and cards linked to a supported hypothesis.",
      ].join(" "),
      inputSchema: {
        ids: z.array(cardRef).min(1).max(MAX_ARCHIVE),
        reason: z
          .string()
          .min(1)
          .describe('Short, such as "merged into H2 summary"'),
      },
    },
    ({ ids, reason }) =>
      guard(async () => {
        if (!ARCHIVERS.has(run.author.role)) {
          throw new ToolRefusal(
            "Only a tidy run archives cards. Leave them and say what should go.",
          );
        }

        const { archived, refused } = await archiveCards(db, run, ids, reason);

        return [
          `Archived ${archived.length} card${archived.length === 1 ? "" : "s"}.`,
          refused.length > 0 && `Kept: ${refused.join("; ")}.`,
        ]
          .filter(Boolean)
          .join(" ");
      }),
  );
};
