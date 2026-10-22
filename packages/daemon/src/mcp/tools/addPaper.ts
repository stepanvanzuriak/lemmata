import { z } from "zod";
import { addPaper } from "../../cards/paper.js";
import { fieldsOf } from "../../cards/types.js";
import { guard, type RegisterTool } from "./shared.js";

export const registerAddPaper: RegisterTool = (server, { db, run, arxiv }) => {
  server.registerTool(
    "add_paper",
    {
      description: [
        "Put an arXiv paper on the canvas as a card, so its full text can be read with read_paper. Returns the card id; adding the same paper again returns the existing card.",
        "id: an arXiv id (as returned by search_literature), link or arXiv: citation. connectFrom: the card it supports (default: the run's target or the goal).",
      ].join(" "),
      inputSchema: {
        id: z.string().min(1),
        connectFrom: z.string().optional(),
      },
    },
    (input) =>
      guard(async () => {
        const card = await addPaper(db, arxiv, run, input);

        return `Paper [${card.id}] "${fieldsOf(card).title}" is on the canvas. Call read_paper with it to read it.`;
      }),
  );
};
