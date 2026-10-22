import { z } from "zod";
import { describeCanvas } from "../../cards/describe.js";
import { findCard } from "../../cards/find.js";
import { cardRef, guard, type RegisterTool } from "./shared.js";

export const registerReadCanvas: RegisterTool = (server, { run, detail }) => {
  server.registerTool(
    "read_canvas",
    {
      description:
        "List every card (id, kind, status, what you may change) and the links. Pass focus to see some cards in full.",
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
