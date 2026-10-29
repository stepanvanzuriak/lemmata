import { z } from "zod";
import { resolveNote } from "../../cards/resolve.js";
import { fieldsOf } from "../../cards/types.js";
import { cardRef, guard, type RegisterTool } from "./shared.js";

export const registerResolveNote: RegisterTool = (server, { db, run }) => {
  server.registerTool(
    "resolve_note",
    {
      description: [
        "Mark a referee note as dealt with, once the canvas answers it: the note stays but stops being shown in full to later runs.",
        "reason: one line on what answers it, naming the cards. Only a note linked from a card with checked-by can be resolved, and only after the work is on the canvas — not because you disagree with it.",
      ].join(" "),
      inputSchema: { id: cardRef, reason: z.string().min(1) },
    },
    ({ id, reason }) =>
      guard(async () => {
        const { note, target } = await resolveNote(db, run, id, reason);

        return `Resolved [${note.id}] "${fieldsOf(note).title}" on ${fieldsOf(target).label ?? `[${target.id}]`}.`;
      }),
  );
};
