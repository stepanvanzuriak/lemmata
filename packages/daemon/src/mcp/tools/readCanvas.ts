import { z } from "zod";
import { describeCanvas } from "../../cards/describe.js";
import { findCard } from "../../cards/find.js";
import { cardRef, guard, type RegisterTool } from "./shared.js";

export const registerReadCanvas: RegisterTool = (server, { run, detail }) => {
  server.registerTool(
    "read_canvas",
    {
      description:
        "Read the whole canvas: cards, their content, status, what you may change, and links. Pass focus to see some cards in full. Use search_cards for a compact index or targeted search.",
      inputSchema: { focus: z.array(cardRef).optional() },
    },
    ({ focus }) =>
      guard(async () => {
        const current = await detail();
        const ids = (focus ?? run.focus ?? [])
          .map((ref) => findCard(current, ref)?.id)
          .filter((id): id is string => Boolean(id));

        return describeCanvas(current, run.author, ids);
      }),
  );
};
