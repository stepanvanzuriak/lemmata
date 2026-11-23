import { ToolRefusal } from "../../cards/types.js";
import { RUNNABLE_KINDS, stopCardRun } from "../../runCard.js";
import { cardRef, guard, type RegisterTool } from "./shared.js";

export const registerStopCard: RegisterTool = (server, { find }) => {
  server.registerTool(
    "stop_card",
    {
      description:
        "Stop a python or lean card that is running, and drop its queued runs. The run_card call waiting on it returns with the output so far; a python card's stderr also shows the stack where it was stopped.",
      inputSchema: { id: cardRef },
    },
    ({ id }) =>
      guard(async () => {
        const { card } = await find(id);

        if (!RUNNABLE_KINDS.has(card.kind)) {
          throw new ToolRefusal(`A ${card.kind} card cannot be run.`);
        }

        const stopped = stopCardRun(card.id);

        return stopped
          ? `Stopped [${card.id}] (${stopped} run${stopped > 1 ? "s" : ""}).`
          : `[${card.id}] is not running.`;
      }),
  );
};
