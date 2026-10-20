import type { Paper } from "shared";

export type FetchFn = typeof fetch;

const API = "https://export.arxiv.org/api/query";
const SPACING_MS = 3_000;
const CACHE_MS = 10 * 60_000;
const TIMEOUT_MS = 20_000;
export const MAX_RESULTS = 25;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decode(text: string) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&(\w+);/g, (whole, name: string) => ENTITIES[name] ?? whole);
}

const squash = (text: string) => decode(text).replace(/\s+/g, " ").trim();

function tag(xml: string, name: string) {
  return xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1];
}

export function arxivId(raw: string) {
  return raw
    .trim()
    .replace(/^.*arxiv\.org\/(abs|pdf)\//i, "")
    .replace(/^arxiv:/i, "")
    .replace(/\.pdf$/i, "")
    .replace(/v\d+$/, "");
}

export function parseAtom(xml: string): Paper[] {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap(
    ([, entry]) => {
      const rawId = tag(entry!, "id");
      const title = squash(tag(entry!, "title") ?? "");

      if (!rawId || title === "Error") {
        return [];
      }

      const id = arxivId(rawId);

      return [
        {
          id,
          title,
          authors: [...entry!.matchAll(/<name>([\s\S]*?)<\/name>/g)].map(
            ([, name]) => squash(name!),
          ),
          published: (tag(entry!, "published") ?? "").slice(0, 10),
          abstract: squash(tag(entry!, "summary") ?? ""),
          url: `https://arxiv.org/abs/${id}`,
        },
      ];
    },
  );
}

const FIELD = /^(all|ti|abs|au|cat|co|jr|rn|id):/i;
const OPERATOR = /^(AND|OR|ANDNOT)$/;

const STOPWORDS = new Set(
  "a an and are as at be by for from in into is it of on or that the to via with without no not all any every some each than then there these this those we our problem".split(
    " ",
  ),
);

const plain = (text: string) =>
  text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

export function searchTerms(query: string): string[] {
  return (plain(query).match(/"[^"]+"|\S+/g) ?? []).flatMap((part) => {
    if (part.startsWith('"')) {
      return part.length > 2 ? [part] : [];
    }

    const word = part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

    if (
      word.length < 2 ||
      STOPWORDS.has(word.toLowerCase()) ||
      !/^[\p{L}\p{N}-]+$/u.test(word)
    ) {
      return [];
    }
    return [word];
  });
}

export const isRawQuery = (query: string) =>
  (query.match(/"[^"]+"|\S+/g) ?? []).some(
    (part) => FIELD.test(part) || OPERATOR.test(part),
  );

export function toSearchQuery(query: string, joiner: "AND" | "OR" = "AND") {
  if (isRawQuery(query)) {
    return plain(query).trim();
  }

  return searchTerms(query)
    .map((term) => `all:${term}`)
    .join(` ${joiner} `);
}

export class ArxivError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArxivError";
  }
}

export type ArxivClient = {
  search: (query: string, max?: number) => Promise<Paper[]>;
  byIds: (ids: string[]) => Promise<Paper[]>;
};

export function createArxivClient(
  fetchFn: FetchFn = fetch,
  spacingMs = SPACING_MS,
): ArxivClient {
  const cache = new Map<string, { at: number; papers: Paper[] }>();
  let queue: Promise<unknown> = Promise.resolve();
  let last = 0;

  async function request(params: URLSearchParams) {
    const key = params.toString();
    const hit = cache.get(key);

    if (hit && Date.now() - hit.at < CACHE_MS) {
      return hit.papers;
    }

    const work = queue.then(async () => {
      const wait = last + spacingMs - Date.now();

      if (wait > 0) {
        await new Promise((done) => setTimeout(done, wait));
      }
      last = Date.now();

      let res: Response;
      try {
        res = await fetchFn(`${API}?${key}`, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        throw new ArxivError(
          `arXiv is unreachable (${error instanceof Error ? error.message : String(error)}).`,
        );
      }
      if (!res.ok) {
        throw new ArxivError(`arXiv answered ${res.status}.`);
      }

      const papers = parseAtom(await res.text());
      cache.set(key, { at: Date.now(), papers });
      return papers;
    });

    queue = work.catch(() => {});
    return work;
  }

  return {
    search: async (query, max = 10) => {
      const searchQuery = toSearchQuery(query);
      const params = (q: string) =>
        new URLSearchParams({
          search_query: q,
          sortBy: "relevance",
          max_results: String(Math.min(Math.max(1, max), MAX_RESULTS)),
        });

      if (!searchQuery) {
        throw new ArxivError("The query has no searchable words.");
      }

      const papers = await request(params(searchQuery));

      if (
        papers.length > 0 ||
        isRawQuery(query) ||
        searchTerms(query).length < 3
      ) {
        return papers;
      }
      return request(params(toSearchQuery(query, "OR")));
    },
    byIds: async (ids) => {
      if (ids.length === 0) {
        return [];
      }
      return request(
        new URLSearchParams({
          id_list: ids.map(arxivId).join(","),
          max_results: String(ids.length),
        }),
      );
    },
  };
}
