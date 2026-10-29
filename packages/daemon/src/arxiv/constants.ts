import { VERSION } from "shared/version";

export const API = "https://export.arxiv.org/api/query";
export const SOURCE_API = "https://arxiv.org/e-print";
export const SPACING_MS = 5_000;
export const CACHE_MS = 10 * 60_000;
export const TIMEOUT_MS = 20_000;
export const MAX_RESULTS = 25;
export const USER_AGENT = `Lemmata/${VERSION} (https://github.com/lemmata; mailto:stepanvanzuriak@gmail.com)`;
export const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
export const MAX_RETRIES = 2;
export const MAX_BACKOFF_MS = 30_000;
export const RETRY_STATUSES = new Set([429, 503]);
export const RATE_LIMITED = 429;
export const MAX_RATE_LIMITS = 2;
export const COOLDOWN_MS = 5 * 60_000;
