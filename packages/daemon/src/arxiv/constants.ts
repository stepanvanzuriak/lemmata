import { VERSION } from "shared/version";

export const API = "https://export.arxiv.org/api/query";
export const SOURCE_API = "https://arxiv.org/e-print";
export const SPACING_MS = 3_000;
export const CACHE_MS = 10 * 60_000;
export const TIMEOUT_MS = 20_000;
export const MAX_RESULTS = 25;
export const USER_AGENT = `Lemmata/${VERSION} (https://github.com/lemmata; mailto:stepanvanzuriak@gmail.com)`;
export const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
export const ARXIV_ID = /^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})$/;
