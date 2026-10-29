import type { PaperPayload } from "shared";
import type { CachedPaper } from "../arxiv/papers.js";
import { clip } from "./describe.js";
import { ToolRefusal } from "./types.js";

export const SECTION_CHARS = 6_000;
export const MAX_MATCHES = 5;
const CONTEXT_CHARS = 300;

export function contentsOf(
  paper: CachedPaper,
  abstract: PaperPayload["abstract"],
) {
  const toc = paper.sections.map(
    (s) => `${s.index}. ${s.title} (${s.end - s.start} chars)`,
  );

  return [
    abstract && `Abstract:\n${abstract}`,
    toc.length > 0
      ? `Sections of the source (${paper.meta.bytes} bytes):\n${toc.join("\n")}`
      : "The source has no sections or theorem environments to address; search it with query.",
    "Call read_paper again with section (an index or part of a title) to read one, or query to search the text.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function sectionOf(paper: CachedPaper, wanted: string) {
  const ref = wanted.trim();
  const lower = ref.toLowerCase();
  const found = /^\d+$/.test(ref)
    ? paper.sections[Number(ref)]
    : (paper.sections.find((s) => s.title.toLowerCase() === lower) ??
      paper.sections.find((s) => s.title.toLowerCase().includes(lower)));

  if (!found) {
    throw new ToolRefusal(
      `No section matches "${wanted}". Call read_paper without section to see the list.`,
    );
  }
  return `${found.index}. ${found.title}\n\n${clip(paper.tex.slice(found.start, found.end), SECTION_CHARS)}`;
}

export function matchesOf(paper: CachedPaper, query: string, max: number) {
  const needle = query.trim().toLowerCase();
  const haystack = paper.tex.toLowerCase();
  const passages: string[] = [];
  let at = haystack.indexOf(needle);

  while (at !== -1 && passages.length < max) {
    const from = Math.max(0, at - CONTEXT_CHARS);
    const to = Math.min(paper.tex.length, at + needle.length + CONTEXT_CHARS);
    const section = paper.sections.findLast((s) => s.start <= at);

    passages.push(
      `[${section ? `${section.index}. ${section.title}` : "before the first section"}]\n...${paper.tex.slice(from, to)}...`,
    );
    at = haystack.indexOf(needle, to);
  }

  if (passages.length === 0) {
    return `"${query}" does not occur in the source. Try a shorter or different term.`;
  }
  return [`${passages.length} passage(s) for "${query}":`, ...passages].join(
    "\n\n",
  );
}
