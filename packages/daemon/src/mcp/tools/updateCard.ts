import { z } from "zod";
import { updateCard } from "../../cards/apply.js";
import { archiveFailedAttackChecks } from "../../cards/archive.js";
import { settleNudge } from "../../cards/goal.js";
import { findCard } from "../../cards/find.js";
import { replaceSection } from "../../cards/sections.js";
import { fieldsOf, isArchived, ToolRefusal } from "../../cards/types.js";
import { cardFields, cardRef, guard, type RegisterTool } from "./shared.js";

export const registerUpdateCard: RegisterTool = (
  server,
  { db, run, detail },
) => {
  server.registerTool(
    "update_card",
    {
      description:
        "Change some fields of a card; fields you leave out stay. Prefer this over adding a note when a card is out of date. status: open/supported/refuted for hypotheses, open/worked/failed for attacks, open/proved/disproved for the goal. Changing source clears the last run.",
      inputSchema: {
        id: cardRef,
        ...cardFields,
        status: z.string().optional(),
        section: z
          .object({
            heading: z.string().trim().min(1).max(120),
            content: z.string(),
          })
          .optional()
          .describe(
            'Replace one section of markdown, e.g. { heading: "Route", content: "…" }: the body under that heading (any level) up to the next heading of the same level is replaced, and a missing section is appended. The rest of the markdown is kept. Use it instead of markdown to update part of a long card. Not together with markdown. For hypotheses and attacks, rewrite the description of the current state; record established results and remaining steps with update_progress, not as run-by-run sections here.',
          ),
      },
    },
    ({ id, section, ...fields }) =>
      guard(async () => {
        const before = await detail();
        const found = findCard(before, id);
        const wasArchived = Boolean(found && isArchived(found));

        if (section) {
          if (fields.markdown !== undefined) {
            throw new ToolRefusal("Pass either markdown or section, not both.");
          }
          if (!found) {
            throw new ToolRefusal(
              `No card matches "${id}". Use an id, "goal", a label like H2, or an exact title.`,
            );
          }
          fields.markdown = replaceSection(
            fieldsOf(found).markdown ?? "",
            section.heading,
            section.content,
          );
        }
        const card = await updateCard(db, run, id, fields);
        const dropped =
          card.kind === "attack" && fields.status === "failed"
            ? await archiveFailedAttackChecks(db, run, card)
            : [];
        const nudge = settleNudge(await detail());

        return [
          `Updated [${card.id}] "${fieldsOf(card).title}".`,
          wasArchived &&
            "It was archived (hidden from the canvas); it is restored and visible again.",
          dropped.length > 0 &&
            `Archived ${dropped.length} check${dropped.length > 1 ? "s" : ""} that only this attack needed and that never passed: ${dropped.map((c) => `"${fieldsOf(c).title}"`).join(", ")}. A claim worth keeping beyond this attack belongs in a hypothesis.`,
          nudge,
        ]
          .filter(Boolean)
          .join("\n");
      }),
  );
};
