const FIELD = /^(all|ti|abs|au|cat|co|jr|rn|id):/i;
const OPERATOR = /^(AND|OR|ANDNOT)$/;

const STOPWORDS = new Set(
  "a an and are as at be by for from in into is it of on or that the to via with without no not all any every some each than then there these this those we our problem".split(
    " ",
  ),
);

const plain = (text: string) => text.normalize("NFKD").replace(/[̀-ͯ]/g, "");

const tokens = (text: string) => text.match(/"[^"]+"|\S+/g) ?? [];

export function searchTerms(query: string): string[] {
  return tokens(plain(query)).flatMap((part) => {
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
  tokens(query).some((part) => FIELD.test(part) || OPERATOR.test(part));

export function toSearchQuery(query: string, joiner: "AND" | "OR" = "AND") {
  if (isRawQuery(query)) {
    return plain(query).trim();
  }

  return searchTerms(query)
    .map((term) => `all:${term}`)
    .join(` ${joiner} `);
}
