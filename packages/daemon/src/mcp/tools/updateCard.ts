import { z } from "zod";
import { updateCard } from "../../cards/apply.js";
import { settleNudge } from "../../cards/goal.js";
import { fieldsOf } from "../../cards/types.js";
import { cardFields, cardRef, guard, type RegisterTool } from "./shared.js";

export const registerUpdateCard: RegisterTool = (
  server,
  { db, run, detail },
) => {
  server.registerTool(
    "update_card",
    {
      description:
        "Change some fields of a card; fields you leave out stay. Prefer this over adding a note when a card is out of date. status: open/supported/refuted for hypotheses, open/proved/disproved for the goal. Changing source clears the last run.",
      inputSchema: {
        id: cardRef,
        ...cardFields,
        status: z.string().optional(),
      },
    },
    ({ id, ...fields }) =>
      guard(async () => {
        const card = await updateCard(db, run, id, fields);
        const nudge = settleNudge(await detail());

        return [`Updated [${card.id}] "${fieldsOf(card).title}".`, nudge]
          .filter(Boolean)
          .join("\n");
      }),
  );
};
