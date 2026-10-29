import type { Paper } from "shared";
import { z } from "zod";
import { MAX_RESULTS } from "../../arxiv/constants.js";
import { guard, type RegisterTool } from "./shared.js";

const ABSTRACT_CHARS = 700;

function describePaper(paper: Paper) {
  const authors = `${paper.authors.slice(0, 4).join(", ")}${paper.authors.length > 4 ? " et al." : ""}`;
  const abstract =
    paper.abstract.length > ABSTRACT_CHARS
      ? `${paper.abstract.slice(0, ABSTRACT_CHARS)}...`
      : paper.abstract;

  return `- arXiv:${paper.id} "${paper.title}" — ${authors} (${paper.published})\n  ${abstract}`;
}

export const registerSearchLiterature: RegisterTool = (
  server,
  { run, arxiv },
) => {
  server.registerTool(
    "search_literature",
    {
      description: [
        `Search arXiv; returns up to ${MAX_RESULTS} papers (id, title, authors, date, abstract), most relevant first.`,
        'Plain words are all required; quote phrases ("rich lines"). arXiv syntax also works: ti:, abs:, au:, cat:math.CO, AND, OR, ANDNOT.',
        "Requests are spaced 3 seconds apart, so prefer a few precise queries.",
      ].join(" "),
      inputSchema: {
        query: z.string().min(1),
        max: z.number().int().min(1).max(MAX_RESULTS).optional(),
      },
    },
    ({ query, max }) =>
      guard(async () => {
        const papers = await arxiv.search(query, max ?? 10);
        run.papers ??= new Map();

        for (const paper of papers) {
          run.papers.set(paper.id, paper);
        }
        if (papers.length === 0) {
          return `No papers match "${query}". Try fewer or broader words.`;
        }
        return [
          `${papers.length} papers for "${query}":`,
          ...papers.map(describePaper),
        ].join("\n");
      }),
  );
};
