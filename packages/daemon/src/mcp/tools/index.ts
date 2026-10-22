import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findCard } from "../../cards/find.js";
import { loadDetail } from "../../cards/load.js";
import { ToolRefusal, type RunContext } from "../../cards/types.js";
import { registerArchiveCards } from "./archiveCards.js";
import { registerConnectCards } from "./connectCards.js";
import { registerCreateCards } from "./createCards.js";
import { registerGetCard } from "./getCard.js";
import { registerReadCanvas } from "./readCanvas.js";
import { registerRecordLiterature } from "./recordLiterature.js";
import { registerRemember } from "./remember.js";
import { registerResolveNote } from "./resolveNote.js";
import { registerRunCard } from "./runCard.js";
import { registerSearchLiterature } from "./searchLiterature.js";
import type { RegisterTool, ToolContext, ToolDeps } from "./shared.js";
import { registerUpdateCard } from "./updateCard.js";

export type { ToolDeps } from "./shared.js";
export { MAX_MEMORY_CHARS, MAX_MEMORY_ENTRIES } from "./remember.js";

const TOOLS: RegisterTool[] = [
  registerReadCanvas,
  registerGetCard,
  registerCreateCards,
  registerUpdateCard,
  registerResolveNote,
  registerConnectCards,
  registerRunCard,
  registerRemember,
  registerSearchLiterature,
  registerRecordLiterature,
  registerArchiveCards,
];

export function registerTools(
  server: McpServer,
  run: RunContext,
  deps: ToolDeps,
) {
  const detail = () => loadDetail(deps.db, run.canvasId);
  const find: ToolContext["find"] = async (ref) => {
    const current = await detail();
    const card = findCard(current, ref);

    if (!card) {
      throw new ToolRefusal(
        `No card matches "${ref}". Call read_canvas to see the cards.`,
      );
    }
    return { card, current };
  };
  const ctx: ToolContext = { ...deps, run, detail, find };

  for (const register of TOOLS) {
    register(server, ctx);
  }
}
