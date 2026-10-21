import { setTimeout as sleep } from "node:timers/promises";
import type { Paper } from "shared";
import { arxivId, parseAtom } from "./atom.js";
import {
  API,
  CACHE_MS,
  MAX_RESULTS,
  SPACING_MS,
  TIMEOUT_MS,
} from "./constants.js";
import { isRawQuery, searchTerms, toSearchQuery } from "./query.js";

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

  private async throttle() {
    const at = Math.max(Date.now(), this.next);
    this.next = at + this.spacingMs;
    await sleep(at - Date.now());
  }

  private async fetchPapers(key: string) {
    await this.throttle();

    let res: Response;
    try {
      res = await this.fetchFn(`${API}?${key}`, {
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
