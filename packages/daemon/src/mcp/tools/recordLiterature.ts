import { LITERATURE_VERDICTS } from "shared";
import { z } from "zod";
import {
  MAX_PAPERS,
  MAX_SUGGESTIONS,
  recordLiterature,
} from "../../cards/literature.js";
import { fieldsOf } from "../../cards/types.js";
import { cardRef, guard, type RegisterTool } from "./shared.js";

export const registerRecordLiterature: RegisterTool = (
  server,
  { db, run, arxiv },
) => {
  server.registerTool(
    "record_literature",
    {
      description: [
        "Write the result of a literature check on a literature card: verdict, a short markdown summary, suggestions, and the papers that matter with one sentence each on why.",
        `verdicts: ${LITERATURE_VERDICTS.join(", ")}. At most ${MAX_PAPERS} papers and ${MAX_SUGGESTIONS} suggestions. Paper ids are arXiv ids from search_literature or from paper cards on the canvas. Calling it again replaces the earlier result. Wrap every formula in $...$ in the summary, suggestions and relevance (e.g. $t_2 \\ge 3 + \\sum_{r\\ge 4}(r-3)t_r$); bare math will not render.`,
      ].join(" "),
      inputSchema: {
        card: cardRef,
        verdict: z.enum(LITERATURE_VERDICTS),
        summary: z
          .string()
          .min(1)
          .describe("Short markdown; every formula wrapped in $...$"),
        suggestions: z.array(z.string()).optional(),
        papers: z.array(
          z.object({ id: z.string(), relevance: z.string().min(1) }),
        ),
        queries: z.array(z.string()).optional(),
      },
    },
    (record) =>
      guard(async () => {
        const card = await recordLiterature(db, arxiv, run, record);
        return `Recorded ${record.verdict} with ${record.papers.length} papers on [${card.id}] "${fieldsOf(card).title}".`;
      }),
  );
};
