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
        `Add up to ${MAX_NEW_CARDS} cards; returns their ids. Give each a title and text (short, shown on the card) or markdown (full body). Write all math as LaTeX in $...$ (inline) or $$...$$ (display) in title, text and markdown alike; never plain-text math.`,
        "Kinds: statement (lemma, claim, definition, finished proof in markdown), hypothesis (approach or conjecture to check; starts open, label given automatically), attack (one concrete route to a hypothesis, to be carried out later; starts open, label A<n> given automatically; connectFrom the hypothesis; put the outline in markdown), python (self-contained check in source, runs in a fresh process), lean (Lean 4 in source, main theorem first), toolbox (the canvas's unique reusable Python and Lean snippets; use python and lean fields), note (remark or question for the user), memory (dead end or fact worth keeping).",
        "Check for a toolbox before writing code; reuse its snippets and update it when improving shared code. A canvas can have only one toolbox.",
        "connectFrom names the parent (may be a card earlier in this call; default: the run's target or the goal). edgeKind defaults to tested-by for python/lean and depends-on otherwise; use refuted-by for evidence against a claim.",
        "Card positions are chosen automatically using the canvas's left-to-right graph layout, avoiding existing cards without moving them.",
        "LaTeX in title, text and markdown is validated before any cards in the batch are saved. If validation fails, fix the indicated field and retry the batch.",
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
