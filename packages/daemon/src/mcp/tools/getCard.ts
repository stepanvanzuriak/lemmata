import { describeOne } from "../../cards/describe.js";
import { cardRef, guard, type RegisterTool } from "./shared.js";

export const registerGetCard: RegisterTool = (server, { run, find }) => {
  server.registerTool(
    "get_card",
    {
      description: "Read one card in full: body, code, last run output, links.",
      inputSchema: { id: cardRef },
    },
    ({ id }) =>
      guard(async () => {
        const { card, current } = await find(id);
        return describeOne(card, current, run.author);
      }),
  );
};
