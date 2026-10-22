import { EDGE_KINDS } from "core";
import { z } from "zod";
import {
  CREATABLE_KINDS,
  createCards,
  MAX_NEW_CARDS,
} from "../../cards/apply.js";
import { fieldsOf } from "../../cards/types.js";
import { cardFields, guard, type RegisterTool } from "./shared.js";

const newCard = z.object({
  kind: z.enum(CREATABLE_KINDS),
  ...cardFields,
  connectFrom: z
    .string()
    .optional()
    .describe("Parent card (also one created earlier in this call)"),
  edgeKind: z.enum(EDGE_KINDS).optional(),
});

export const registerCreateCards: RegisterTool = (server, { db, run }) => {
  server.registerTool(
    "create_cards",
    {
      description: [
        `Add up to ${MAX_NEW_CARDS} cards; returns their ids. Give each a title and text (short, shown on the card) or markdown (full body).`,
        "Kinds: statement (lemma, claim, definition, finished proof in markdown), hypothesis (approach or conjecture to check; starts open, label given automatically), python (self-contained check in source, runs in a fresh process), lean (Lean 4 in source, main theorem first), note (remark or question for the user), memory (dead end or fact worth keeping).",
        "connectFrom names the parent (may be a card earlier in this call; default: the run's target or the goal). edgeKind defaults to tested-by for python/lean and depends-on otherwise; use refuted-by for evidence against a claim.",
      ].join(" "),
      inputSchema: { cards: z.array(newCard).min(1).max(MAX_NEW_CARDS) },
    },
    ({ cards }) =>
      guard(async () => {
        const created = await createCards(db, run, cards);
        return created
          .map(
            (c) =>
              `Created ${c.kind} [${c.id}]${fieldsOf(c).label ? ` ${fieldsOf(c).label}` : ""} "${fieldsOf(c).title}"`,
          )
          .join("\n");
      }),
  );
};
