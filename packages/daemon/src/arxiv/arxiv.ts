import { setTimeout as sleep } from "node:timers/promises";
import type { Paper } from "shared";
import { arxivId, parseAtom } from "./atom.js";
import {
  API,
  SOURCE_API,
  CACHE_MS,
  MAX_RESULTS,
  SPACING_MS,
  TIMEOUT_MS,
  USER_AGENT,
} from "./constants.js";
import { isRawQuery, searchTerms, toSearchQuery } from "./query.js";
import { unpackSource, type SourceFile } from "./source.js";

export type FetchFn = typeof fetch;

export class ArxivError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArxivError";
  }
}

export type ArxivClient = {
  search: (query: string, max?: number) => Promise<Paper[]>;
  byIds: (ids: string[]) => Promise<Paper[]>;
  fetchSource: (id: string) => Promise<SourceFile>;
};

export class HttpArxivClient implements ArxivClient {
  private readonly cache = new Map<
    string,
    { at: number; papers: Promise<Paper[]> }
  >();
  private next = 0;

  constructor(
    private readonly fetchFn: FetchFn = fetch,
    private readonly spacingMs = SPACING_MS,
  ) {}

  async search(query: string, max = 10) {
    const limit = String(Math.min(Math.max(1, max), MAX_RESULTS));
    const run = (searchQuery: string) =>
      this.request(
        new URLSearchParams({
          search_query: searchQuery,
          sortBy: "relevance",
          max_results: limit,
        }),
      );
    const strict = toSearchQuery(query);

    if (!strict) {
      throw new ArxivError("The query has no searchable words.");
    }

    const papers = await run(strict);

    if (
      papers.length > 0 ||
      isRawQuery(query) ||
      searchTerms(query).length < 3
    ) {
      return papers;
    }
    return run(toSearchQuery(query, "OR"));
  }

  async byIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    return this.request(
      new URLSearchParams({
        id_list: ids.map(arxivId).join(","),
        max_results: String(ids.length),
      }),
    );
  }

  async fetchSource(id: string) {
    const arxivFormatedId = arxivId(id);
    const res = await this.get(`${SOURCE_API}/${arxivFormatedId}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const files = unpackSource(bytes);
    const texFiles = files.filter(({ name }) => name.endsWith(".tex"));
    const decoder = new TextDecoder("utf-8");
    const largest = texFiles.reduce<SourceFile | undefined>(
      (largest, file) =>
        !largest || file.data.length > largest.data.length ? file : largest,
      undefined,
    );
    const mainFile = texFiles.find(({ data }) =>
      decoder.decode(data).includes("\\documentclass"),
    );

    if (!mainFile && !largest) {
      throw new ArxivError(`arXiv has no TeX source for ${id}.`);
    }

    return mainFile ?? largest!;
  }

  async get(url: string) {
    await this.throttle();

    let res: Response;
    try {
      res = await this.fetchFn(url, {
        headers: { "User-Agent": USER_AGENT },
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

    return res;
  }

  private async throttle() {
    const at = Math.max(Date.now(), this.next);
    this.next = at + this.spacingMs;
    await sleep(at - Date.now());
  }

  private async fetchPapers(key: string) {
    const res = await this.get(`${API}?${key}`);

    return parseAtom(await res.text());
  }

  private request(params: URLSearchParams) {
    const key = params.toString();
    const hit = this.cache.get(key);

    if (hit && Date.now() - hit.at < CACHE_MS) {
      return hit.papers;
    }

    const papers = this.fetchPapers(key);
    this.cache.set(key, { at: Date.now(), papers });
    papers.catch(() => this.cache.delete(key));
    return papers;
  }
}
