const ARXIV_ID = /^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})$/;

export function parseArxivId(raw: string): string | undefined {
  const id = raw
    .trim()
    .replace(/^.*arxiv\.org\/(abs|pdf)\//i, "")
    .replace(/^arxiv:/i, "")
    .replace(/\.pdf$/i, "")
    .replace(/v\d+$/, "");

  return ARXIV_ID.test(id) ? id : undefined;
}
