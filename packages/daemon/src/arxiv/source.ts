import { gunzipSync } from "node:zlib";
import { parseTar } from "nanotar";

export type SourceFile = { name: string; data: Uint8Array };
export type PaperSource = { file: SourceFile; files: string[] };

const SINGLE_FILE = "main.tex";
const COMMENT_ENV = /\\begin\{comment\}[\s\S]*?\\end\{comment\}/g;
const LINE_COMMENT = /((?:^|[^\\])(?:\\\\)*)%.*$/gm;
const ANCHOR =
  /\\(?:sub)*section\*?|\\begin\{(?:theorem|lemma|proposition|corollary|definition|conjecture)\*?\}/g;

const isTar = (bytes: Uint8Array) =>
  bytes.length >= 512 &&
  new TextDecoder().decode(bytes.subarray(257, 262)) === "ustar";

export function unpackSource(gzipped: Uint8Array): SourceFile[] {
  const bytes = new Uint8Array(gunzipSync(gzipped));

  if (!isTar(bytes)) {
    return [{ name: SINGLE_FILE, data: bytes }];
  }

  return parseTar(bytes, { filter: (entry) => entry.type === "file" }).map(
    ({ name, data }) => ({ name, data: data ?? new Uint8Array() }),
  );
}

export type Section = {
  index: number;
  title: string;
  start: number;
  end: number;
};

export function cleanTex(tex: string) {
  return tex
    .replace(COMMENT_ENV, "")
    .replace(LINE_COMMENT, "$1")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readGroup(tex: string, from: number) {
  if (tex[from] !== "{") {
    return undefined;
  }

  let depth = 0;
  for (let i = from; i < tex.length; i++) {
    if (tex[i] === "{" && tex[i - 1] !== "\\") {
      depth++;
    } else if (tex[i] === "}" && tex[i - 1] !== "\\") {
      depth--;
      if (depth === 0) {
        return tex.slice(from + 1, i);
      }
    }
  }
  return undefined;
}

function anchorTitle(tex: string, match: RegExpMatchArray) {
  const at = match.index! + match[0].length;
  const squash = (text: string) => text.replace(/\s+/g, " ").trim();

  if (match[0].startsWith("\\begin")) {
    const name = match[0].slice(7, -1).replace("*", "");
    const note = /^\s*\[([^\]]*)\]/.exec(tex.slice(at, at + 200))?.[1];

    return note ? `${name} (${squash(note)})` : name;
  }

  const optional = /^\s*\[[^\]]*\]/.exec(tex.slice(at, at + 200))?.[0] ?? "";
  const rest = tex.slice(at + optional.length);
  const group = readGroup(rest, rest.search(/\S/));

  return squash(group ?? "") || "(untitled)";
}

export function sectionsOf(tex: string): Section[] {
  const matches = [...tex.matchAll(ANCHOR)];

  return matches.map((match, index) => ({
    index,
    title: anchorTitle(tex, match),
    start: match.index!,
    end: matches[index + 1]?.index ?? tex.length,
  }));
}
