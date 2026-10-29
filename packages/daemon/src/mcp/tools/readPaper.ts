import { z } from "zod";
import { fetchPaperSource } from "../../cards/paper.js";
import {
  contentsOf,
  matchesOf,
  MAX_MATCHES,
  sectionOf,
} from "../../cards/readPaper.js";
import { cardRef, guard, type RegisterTool } from "./shared.js";

export const registerReadPaper: RegisterTool = (
  server,
  { db, run, arxiv, workspaceDir },
) => {
  server.registerTool(
    "read_paper",
    {
      description: [
        "Read a paper card's full text (the arXiv source, LaTeX) one part at a time; the first call fetches and caches it.",
        "With neither section nor query: the abstract and the list of sections. section: an index or part of a title from that list; returns that part, clipped at about 6000 characters. query: literal text to find (case-insensitive); returns up to max passages (default and most 5) with their surroundings, which is the way to locate one step or theorem.",
        "Use arXiv:<id> when citing it; the source can differ from the published version.",
      ].join(" "),
      inputSchema: {
        card: cardRef,
        section: z.string().min(1).optional(),
        query: z.string().min(1).optional(),
        max: z.number().int().min(1).max(MAX_MATCHES).optional(),
      },
    },
    ({ card, section, query, max }) =>
      guard(async () => {
        const { card: paperCard, paper } = await fetchPaperSource(
          db,
          arxiv,
          workspaceDir,
          run,
          card,
        );

        if (section) {
          return sectionOf(paper, section);
        }
        if (query) {
          return matchesOf(paper, query, max ?? MAX_MATCHES);
        }
        return contentsOf(
          paper,
          (paperCard.payload as { abstract?: string }).abstract,
        );
      }),
  );
};
