import { XMLParser } from "fast-xml-parser";
import { parseArxivId, type Paper } from "shared";
import { ArxivError } from "./errors.js";

const parser = new XMLParser({
  parseTagValue: false,
  htmlEntities: true,
  isArray: (name) => name === "entry" || name === "author",
});

type Entry = {
  id?: string;
  title?: string;
  published?: string;
  summary?: string;
  author?: { name?: string }[];
};

const squash = (text = "") => text.replace(/\s+/g, " ").trim();

export function arxivId(raw: string) {
  const id = parseArxivId(raw);

  if (!id) {
    throw new ArxivError(
      `"${raw}" is not an arXiv id. Use an id such as 1107.0327, or an arxiv.org/abs link.`,
    );
  }
  return id;
}

export function parseAtom(xml: string): Paper[] {
  const entries: Entry[] = parser.parse(xml).feed?.entry ?? [];

  return entries.flatMap((entry) => {
    const title = squash(entry.title);

    if (!entry.id || title === "Error") {
      return [];
    }

    const id = arxivId(entry.id);

    return [
      {
        id,
        title,
        authors: (entry.author ?? []).map((author) => squash(author.name)),
        published: (entry.published ?? "").slice(0, 10),
        abstract: squash(entry.summary),
        url: `https://arxiv.org/abs/${id}`,
      },
    ];
  });
}
