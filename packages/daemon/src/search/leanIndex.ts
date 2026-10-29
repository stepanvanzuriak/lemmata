import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

export type LeanEntry = {
  /** Fully qualified name as declared (namespaces applied). */
  name: string;
  kind: string;
  module: string;
  file: string;
  line: number;
  signature: string;
  doc: string;
};

export type LeanModule = { module: string; doc: string };

export type LeanIndex = {
  modules: LeanModule[];
  /** Per file: module name and path on disk. */
  files: { module: string; path: string }[];
  names: string[];
  kinds: Uint8Array;
  fileOf: Uint32Array;
  lines: Uint32Array;
  /** Byte offsets of each entry's search text in `corpus`; one extra at the end. */
  offsets: Uint32Array;
  /** Lowercase search text of every entry, one UTF-8 buffer scanned natively. */
  corpus: Buffer;
};

export type LeanRoot = { dir: string; skip?: string[] };

const DECL =
  /^\s*(?:@\[[^\]]*\]\s*)*(?:(?:protected|private|noncomputable|unsafe|partial|nonrec|public|meta)\s+)*(theorem|lemma|def|abbrev|structure|class inductive|class|inductive|axiom|opaque|instance|irreducible_def)\s+([^\s({[:⦃]+)/;
const NAMESPACE = /^\s*namespace\s+(\S+)/;
const SECTION = /^\s*(?:noncomputable\s+)?section\b/;
const END = /^\s*end(?:\s+(\S+))?\s*$/;
const SKIPPED_DIRS = new Set([
  ".lake",
  ".git",
  "test",
  "tests",
  "MathlibTest",
  "Archive",
  "Counterexamples",
  "docs",
  "scripts",
  "build",
]);
const MAX_SIGNATURE_LINES = 10;
const MAX_SIGNATURE_CHARS = 500;

async function leanFiles(dir: string): Promise<string[]> {
  const found: string[] = [];

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) {
        found.push(...(await leanFiles(path)));
      }
    } else if (entry.name.endsWith(".lean")) {
      found.push(path);
    }
  }
  return found;
}

/** The text of the doc comment that ends just above line `end`, or "". */
function docBefore(lines: string[], end: number) {
  let i = end - 1;

  while (i >= 0 && /^\s*(@\[.*\]\s*)?$/.test(lines[i]!)) {
    i--;
  }
  if (i < 0 || !lines[i]!.trimEnd().endsWith("-/")) {
    return "";
  }

  let start = i;

  while (start >= 0 && !lines[start]!.includes("/--")) {
    if (lines[start]!.includes("/-") && start !== i) {
      return "";
    }
    start--;
  }
  if (start < 0) {
    return "";
  }
  return lines
    .slice(start, i + 1)
    .join(" ")
    .replace(/\/--|-\//g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

function signatureFrom(lines: string[], start: number) {
  const parts: string[] = [];

  for (
    let i = start;
    i < lines.length && i < start + MAX_SIGNATURE_LINES;
    i++
  ) {
    const line = lines[i]!;
    const cut = line.search(/:=|\swhere\b|\s\|\s|^\s*\|/);

    if (cut >= 0) {
      parts.push(line.slice(0, cut));
      break;
    }
    parts.push(line);
    if (
      line.trim() === "" ||
      /^\s*(theorem|lemma|def)\b/.test(lines[i + 1] ?? "")
    ) {
      break;
    }
  }
  return parts
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SIGNATURE_CHARS);
}

export function parseLeanFile(source: string, module: string, file = "") {
  const lines = source.split("\n");
  const entries: LeanEntry[] = [];
  const scopes: { name: string | null }[] = [];
  let moduleDoc = "";
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (!moduleDoc && line.includes("/-!")) {
      const end = lines.findIndex((l, j) => j >= i && l.includes("-/"));
      moduleDoc = lines
        .slice(i, (end < 0 ? i : end) + 1)
        .join(" ")
        .replace(/\/-!|-\//g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 400);
    }
    // Skip block comments so commented-out code is not indexed.
    if (inBlock) {
      if (line.includes("-/")) {
        inBlock = false;
      }
      continue;
    }
    if (/^\s*\/-/.test(line) && !line.includes("-/")) {
      inBlock = true;
      continue;
    }

    const ns = line.match(NAMESPACE);

    if (ns) {
      for (const part of ns[1]!.split(".")) {
        scopes.push({ name: part });
      }
      continue;
    }
    if (SECTION.test(line)) {
      const named = line.match(/section\s+(\S+)/);

      scopes.push({ name: null });
      if (named) {
        // Named sections are closed by `end Name`; treat them as anonymous.
      }
      continue;
    }

    const end = line.match(END);

    if (end) {
      const parts = end[1]?.split(".") ?? [""];

      for (let n = 0; n < parts.length; n++) {
        scopes.pop();
      }
      continue;
    }

    const decl = line.match(DECL);

    if (!decl) {
      continue;
    }

    let name = decl[2]!.replace(/\.\{.*$/, "");
    const kind = decl[1] === "lemma" ? "theorem" : decl[1]!;

    if (name.startsWith("_root_.")) {
      name = name.slice(7);
    } else {
      const prefix = scopes.flatMap((s) => (s.name ? [s.name] : [])).join(".");
      name = prefix ? `${prefix}.${name}` : name;
    }
    entries.push({
      name,
      kind,
      module,
      file,
      line: i + 1,
      signature: signatureFrom(lines, i),
      doc: docBefore(lines, i),
    });
  }

  return { entries, moduleDoc };
}

const KINDS = [
  "theorem",
  "def",
  "abbrev",
  "structure",
  "class",
  "class inductive",
  "inductive",
  "instance",
  "axiom",
  "opaque",
  "irreducible_def",
];
const SEP = "\u0001";

const words = (text: string) =>
  text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * Compact on purpose: the full signatures and docstrings of ~300k Mathlib
 * declarations are only searched, never kept as strings. They live in one
 * lowercase buffer (name, name words, signature, doc, module per entry) and
 * are re-read from the source files for the few hits that get shown.
 */
export async function buildLeanIndex(roots: LeanRoot[]): Promise<LeanIndex> {
  const files: LeanIndex["files"] = [];

  for (const root of roots) {
    for (const path of (await leanFiles(root.dir).catch(() => [])).sort()) {
      files.push({
        path,
        module: relative(root.dir, path)
          .replace(/\.lean$/, "")
          .split("/")
          .join("."),
      });
    }
  }

  const parsed = await Promise.all(
    files.map(async (file) =>
      parseLeanFile(await readFile(file.path, "utf8"), file.module, file.path),
    ),
  );
  const names: string[] = [];
  const kinds: number[] = [];
  const fileOf: number[] = [];
  const lines: number[] = [];
  const offsets: number[] = [];
  const chunks: Buffer[] = [];
  const modules: LeanModule[] = [];
  let size = 0;

  parsed.forEach(({ entries, moduleDoc }, f) => {
    modules.push({ module: files[f]!.module, doc: moduleDoc });
    for (const e of entries) {
      const text = Buffer.from(
        [e.name, ` ${words(e.name).join(" ")} `, e.signature, e.doc, e.module]
          .join(SEP)
          .toLowerCase() + "\n",
      );

      names.push(e.name);
      kinds.push(KINDS.indexOf(e.kind));
      fileOf.push(f);
      lines.push(e.line);
      offsets.push(size);
      chunks.push(text);
      size += text.length;
    }
  });
  offsets.push(size);
  modules.sort((a, b) => a.module.localeCompare(b.module));

  return {
    modules,
    files,
    names,
    kinds: Uint8Array.from(kinds),
    fileOf: Uint32Array.from(fileOf),
    lines: Uint32Array.from(lines),
    offsets: Uint32Array.from(offsets),
    corpus: Buffer.concat(chunks, size),
  };
}

let cached: { key: string; index: Promise<LeanIndex> } | undefined;

/** Built once per set of roots and reused until the installed libraries change. */
export async function leanIndex(roots: LeanRoot[]): Promise<LeanIndex> {
  const stamps = await Promise.all(
    roots.map((r) =>
      stat(r.dir)
        .then((s) => `${r.dir}:${s.mtimeMs}`)
        .catch(() => r.dir),
    ),
  );
  const key = stamps.join("|");

  if (cached?.key !== key) {
    cached = { key, index: buildLeanIndex(roots) };
  }
  return cached.index;
}

export type LeanHit = { id: number; score: number };

export const entryCount = (index: LeanIndex) => index.names.length;

/** The entry whose text contains byte `position`. */
function entryAt(index: LeanIndex, position: number) {
  let low = 0;
  let high = index.names.length - 1;

  while (low < high) {
    const mid = (low + high + 1) >> 1;

    if (index.offsets[mid]! <= position) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

/** `[name, name words, signature, doc, module]`, lowercase. */
const fieldsOf = (index: LeanIndex, id: number) =>
  index.corpus
    .toString("utf8", index.offsets[id], index.offsets[id + 1])
    .split(SEP);

function rank(hits: LeanHit[], index: LeanIndex) {
  return hits.sort(
    (a, b) =>
      b.score - a.score ||
      index.names[a.id]!.length - index.names[b.id]!.length ||
      index.names[a.id]!.localeCompare(index.names[b.id]!),
  );
}

/** Every query word must appear; name matches outrank signature and doc matches. */
export function searchEntries(index: LeanIndex, query: string): LeanHit[] {
  const wanted = words(query);
  const exact = query.trim().toLowerCase();

  if (wanted.length === 0) {
    return [];
  }

  // Scan the whole corpus natively for the longest (rarest) word, then check
  // the rest on just those entries.
  const anchor = wanted.reduce((a, b) => (b.length > a.length ? b : a));
  const hits: LeanHit[] = [];
  let position = index.corpus.indexOf(anchor);

  while (position >= 0) {
    const id = entryAt(index, position);
    const [name = "", nameWords = "", signature = "", doc = "", module = ""] =
      fieldsOf(index, id);
    const all = `${name} ${signature} ${doc} ${module}`;

    if (wanted.every((word) => all.includes(word))) {
      let score = 0;

      for (const word of wanted) {
        if (nameWords.includes(` ${word} `)) {
          score += 10;
        } else if (name.includes(word)) {
          score += 6;
        } else {
          score += 3;
        }
      }
      if (name === exact) {
        score += 100;
      } else if (name.endsWith(`.${exact}`)) {
        score += 50;
      } else if (name.includes(exact)) {
        score += 20;
      }
      hits.push({ id, score });
    }
    position = index.corpus.indexOf(anchor, index.offsets[id + 1]);
  }
  return rank(hits, index);
}

/** Names are matched as written; signatures from their lowercase text. */
export function searchRegex(index: LeanIndex, pattern: RegExp): LeanHit[] {
  const loose = new RegExp(
    pattern.source,
    pattern.flags.replace("i", "") + "i",
  );
  const hits: LeanHit[] = [];

  for (let id = 0; id < index.names.length; id++) {
    if (
      pattern.test(index.names[id]!) ||
      loose.test(fieldsOf(index, id)[2] ?? "")
    ) {
      hits.push({ id, score: 0 });
    }
  }
  return hits.sort((a, b) =>
    index.names[a.id]!.localeCompare(index.names[b.id]!),
  );
}

export const kindOf = (index: LeanIndex, id: number) =>
  KINDS[index.kinds[id]!] ?? "def";

export const moduleOf = (index: LeanIndex, id: number) =>
  index.files[index.fileOf[id]!]!.module;

export function searchModules(index: LeanIndex, query: string) {
  const wanted = words(query);

  return index.modules.filter((m) => {
    const text = `${m.module} ${m.doc}`.toLowerCase();

    return wanted.length > 0 && wanted.every((w) => text.includes(w));
  });
}

/** Full declarations (signature, doc) for the hits being shown, read from disk. */
export async function describeHits(
  index: LeanIndex,
  ids: number[],
): Promise<LeanEntry[]> {
  const parsed = new Map<number, Promise<LeanEntry[]>>();
  const entriesOf = (f: number) => {
    let entries = parsed.get(f);

    if (!entries) {
      const file = index.files[f]!;

      entries = readFile(file.path, "utf8").then(
        (source) => parseLeanFile(source, file.module, file.path).entries,
      );
      parsed.set(f, entries);
    }
    return entries;
  };

  return Promise.all(
    ids.map(async (id) => {
      const entries = await entriesOf(index.fileOf[id]!);
      const found = entries.find(
        (e) => e.line === index.lines[id] && e.name === index.names[id],
      );

      return (
        found ?? {
          name: index.names[id]!,
          kind: kindOf(index, id),
          module: moduleOf(index, id),
          file: index.files[index.fileOf[id]!]!.path,
          line: index.lines[id]!,
          signature: "",
          doc: "",
        }
      );
    }),
  );
}
