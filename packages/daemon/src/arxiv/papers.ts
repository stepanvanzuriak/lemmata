import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ArxivError, type ArxivClient } from "./arxiv.js";
import { arxivId } from "./atom.js";
import { ARXIV_ID } from "./constants.js";
import { cleanTex, sectionsOf, type Section } from "./source.js";

export type PaperMeta = {
  id: string;
  fetchedAt: string;
  file: string;
  bytes: number;
  files: string[];
};

export type CachedPaper = { meta: PaperMeta; tex: string; sections: Section[] };

const paperDir = (workspaceDir: string, id: string) =>
  join(workspaceDir, ".lemmata", "papers", id.replace("/", "_"));

async function readCached(dir: string) {
  try {
    const [tex, meta] = await Promise.all([
      readFile(join(dir, "source.tex"), "utf8"),
      readFile(join(dir, "meta.json"), "utf8"),
    ]);

    return { meta: JSON.parse(meta) as PaperMeta, tex };
  } catch {
    return undefined;
  }
}

export async function loadPaper(
  arxiv: ArxivClient,
  workspaceDir: string,
  rawId: string,
  { refresh = false } = {},
): Promise<CachedPaper> {
  const id = arxivId(rawId);

  if (!ARXIV_ID.test(id)) {
    throw new ArxivError(`"${rawId}" is not an arXiv id.`);
  }

  const dir = paperDir(workspaceDir, id);
  const cached = refresh ? undefined : await readCached(dir);

  if (cached) {
    return { ...cached, sections: sectionsOf(cached.tex) };
  }

  const { file, files } = await arxiv.fetchSource(id);
  const tex = cleanTex(new TextDecoder("utf-8").decode(file.data));
  const meta: PaperMeta = {
    id,
    fetchedAt: new Date().toISOString(),
    file: file.name,
    bytes: file.data.length,
    files,
  };

  await mkdir(dir, { recursive: true });
  await Promise.all([
    writeFile(join(dir, "source.tex"), tex),
    writeFile(join(dir, "meta.json"), JSON.stringify(meta, null, 2)),
  ]);

  return { meta, tex, sections: sectionsOf(tex) };
}
