import { deleteNode } from "core";
import { z } from "zod";
import { guard, type RegisterTool } from "./shared.js";

export const registerDeleteToolbox: RegisterTool = (server, { db, find }) => {
  server.registerTool(
    "delete_toolbox",
    {
      description:
        "Permanently delete this canvas's toolbox card. Use only when the shared snippets are no longer useful; prefer update_card to change them.",
      inputSchema: {
        id: z.string().describe("Toolbox card id or exact title"),
      },
    },
    ({ id }) =>
      guard(async () => {
        const { card } = await find(id);
        if (card.kind !== "toolbox") {
          throw new Error("delete_toolbox only deletes a toolbox card");
        }
        await deleteNode(db, card.id);
        return `Deleted toolbox [${card.id}].`;
      }),
  );
};
