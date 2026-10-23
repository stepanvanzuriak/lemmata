import { setTimeout as sleep } from "node:timers/promises";
import type { Paper } from "shared";
import { arxivId, parseAtom } from "./atom.js";
import { ArxivError } from "./errors.js";
import {
  API,
  SOURCE_API,
  CACHE_MS,
  MAX_DOWNLOAD_BYTES,
  MAX_SOURCE_BYTES,
  MAX_RESULTS,
  COOLDOWN_MS,
  MAX_BACKOFF_MS,
  MAX_RATE_LIMITS,
  MAX_RETRIES,
  RATE_LIMITED,
  RETRY_STATUSES,
  SPACING_MS,
  TIMEOUT_MS,
  USER_AGENT,
} from "./constants.js";
import { isRawQuery, searchTerms, toSearchQuery } from "./query.js";
import { unpackSource, type PaperSource, type SourceFile } from "./source.js";

export type FetchFn = typeof fetch;

export { ArxivError };

export type ArxivClient = {
  search: (query: string, max?: number) => Promise<Paper[]>;
  byIds: (ids: string[]) => Promise<Paper[]>;
  fetchSource: (id: string) => Promise<PaperSource>;
};

export class HttpArxivClient implements ArxivClient {
  private readonly cache = new Map<
    string,
    { at: number; papers: Promise<Paper[]> }
  >();
  private next = 0;
  private rateLimits = 0;
  private blockedUntil = 0;

  constructor(
    private readonly fetchFn: FetchFn = fetch,
    private readonly spacingMs = SPACING_MS,
    private readonly cooldownMs = COOLDOWN_MS,
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

  async fetchSource(id: string): Promise<PaperSource> {
    const clean = arxivId(id);

    const res = await this.get(`${SOURCE_API}/${clean}`);
    const declared = Number(res.headers.get("content-length") ?? 0);

    if (declared > MAX_DOWNLOAD_BYTES) {
      throw new ArxivError(`The source of ${clean} is too large to fetch.`);
    }

    const bytes = new Uint8Array(await res.arrayBuffer());

    if (bytes.length > MAX_DOWNLOAD_BYTES) {
      throw new ArxivError(`The source of ${clean} is too large to fetch.`);
    }

    let files: SourceFile[];
    try {
      files = unpackSource(bytes);
    } catch {
      throw new ArxivError(`arXiv has no TeX source for ${clean}.`);
    }

    const texFiles = files.filter(({ name }) => name.endsWith(".tex"));
    const decoder = new TextDecoder("utf-8");
    const largest = texFiles.reduce<SourceFile | undefined>(
      (best, file) =>
        !best || file.data.length > best.data.length ? file : best,
      undefined,
    );
    const file =
      texFiles.find(({ data }) =>
        decoder.decode(data).includes("\\documentclass"),
      ) ?? largest;

    if (!file) {
      throw new ArxivError(`arXiv has no TeX source for ${clean}.`);
    }
    if (file.data.length > MAX_SOURCE_BYTES) {
      throw new ArxivError(`The main TeX file of ${clean} is too large.`);
    }

    return { file, files: files.map(({ name }) => name) };
  }

  async get(url: string) {
    for (let attempt = 0; ; attempt++) {
      this.checkCooldown();
      await this.throttle();
      this.checkCooldown();

      let res: Response;
      try {
        res = await this.fetchFn(url, {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        if (attempt < MAX_RETRIES) {
          await sleep(this.backoff(attempt));
          continue;
        }
        throw new ArxivError(
          `arXiv is unreachable (${error instanceof Error ? error.message : String(error)}).`,
        );
      }
      if (res.ok) {
        this.rateLimits = 0;
        return res;
      }
      if (res.status === RATE_LIMITED && ++this.rateLimits >= MAX_RATE_LIMITS) {
        this.rateLimits = 0;
        this.blockedUntil = Date.now() + this.cooldownMs;
        this.checkCooldown();
      }
      if (RETRY_STATUSES.has(res.status) && attempt < MAX_RETRIES) {
        await sleep(this.backoff(attempt, res.headers.get("retry-after")));
        continue;
      }
      throw new ArxivError(`arXiv answered ${res.status}.`);
    }
  }

  private backoff(attempt: number, retryAfter?: string | null) {
    const seconds = Number(retryAfter);
    const base = this.spacingMs * 2 ** (attempt + 1);

    return Number.isFinite(seconds) && seconds > 0
      ? Math.min(seconds * 1000, MAX_BACKOFF_MS)
      : Math.min(base, MAX_BACKOFF_MS);
  }

  private checkCooldown() {
    const left = this.blockedUntil - Date.now();

    if (left > 0) {
      throw new ArxivError(
        `arXiv is rate-limiting this machine. Wait ${Math.ceil(left / 60_000)} min before searching again; do not record a verdict meanwhile.`,
      );
    }
  }

  private async throttle() {
    const at = Math.max(Date.now(), this.next);
    this.next = at + this.spacingMs;
    await sleep(Math.max(0, at - Date.now()));
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
