import { XMLParser } from "fast-xml-parser";
import type { Paper } from "shared";

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
  return raw
    .trim()
    .replace(/^.*arxiv\.org\/(abs|pdf)\//i, "")
    .replace(/^arxiv:/i, "")
    .replace(/\.pdf$/i, "")
    .replace(/v\d+$/, "");
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
