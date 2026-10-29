import { addEdge, EDGE_KINDS } from "core";
import { z } from "zod";
import { fieldsOf, ToolRefusal } from "../../cards/types.js";
import { cardRef, guard, type RegisterTool } from "./shared.js";

export const registerConnectCards: RegisterTool = (
  server,
  { db, run, find },
) => {
  server.registerTool(
    "connect_cards",
    {
      description:
        "Link two existing cards (no duplicates). from depends-on to: from needs to. from tested-by/checked-by to: to is a check of from. from refuted-by to: to is evidence against from. from used-by to: to builds on from.",
      inputSchema: { from: cardRef, to: cardRef, kind: z.enum(EDGE_KINDS) },
    },
    ({ from, to, kind }) =>
      guard(async () => {
        const source = (await find(from)).card;
        const target = (await find(to)).card;

        if (source.id === target.id) {
          throw new ToolRefusal("A card cannot link to itself.");
        }

        await addEdge(db, {
          canvasId: run.canvasId,
          fromNode: source.id,
          toNode: target.id,
          kind,
        });
        return `Linked "${fieldsOf(source).title}" ${kind} "${fieldsOf(target).title}".`;
      }),
  );
};
