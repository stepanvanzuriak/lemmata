import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { createTar } from "nanotar";
import { expect, it, vi } from "vitest";
import { ArxivError, HttpArxivClient } from "../arxiv/arxiv.js";
import { MAX_SOURCE_BYTES } from "../arxiv/constants.js";
import { loadPaper } from "../arxiv/papers.js";
import { cleanTex, sectionsOf, unpackSource } from "../arxiv/source.js";

const text = (data: Uint8Array) => new TextDecoder().decode(data);

it("unpacks a gzipped tar of the source tree", () => {
  const tar = createTar([
    { name: "paper/" },
    { name: "paper/main.tex", data: "\\documentclass{amsart}" },
    { name: "paper/fig.pdf", data: new Uint8Array([1, 2, 3]) },
  ]);

  const files = unpackSource(gzipSync(tar));

  expect(files.map((f) => f.name)).toEqual(["paper/main.tex", "paper/fig.pdf"]);
  expect(text(files[0]!.data)).toBe("\\documentclass{amsart}");
});

it("treats a gzipped non-tar as a single file", () => {
  const files = unpackSource(gzipSync("\\documentclass{article}"));

  expect(files).toHaveLength(1);
  expect(text(files[0]!.data)).toBe("\\documentclass{article}");
});

it("throws on bytes that are not gzip", () => {
  expect(() => unpackSource(new TextEncoder().encode("%PDF-1.5"))).toThrow();
});

const sourceClient = (body: Uint8Array | string, init?: ResponseInit) => {
  const fetchFn = vi.fn(async () => new Response(body as BodyInit, init));

  return { fetchFn, client: new HttpArxivClient(fetchFn as never, 0) };
};

it("picks the file with \\documentclass from a tar of three files", async () => {
  const tar = createTar([
    { name: "intro.tex", data: "\\section{Intro} ".repeat(50) },
    { name: "main.tex", data: "\\documentclass{amsart}" },
    { name: "refs.tex", data: "x".repeat(500) },
  ]);
  const { client } = sourceClient(gzipSync(tar));

  const { file, files } = await client.fetchSource("2101.01234");

  expect(file.name).toBe("main.tex");
  expect(files).toEqual(["intro.tex", "main.tex", "refs.tex"]);
});

it("falls back to the largest .tex when none has \\documentclass", async () => {
  const tar = createTar([
    { name: "a.tex", data: "short" },
    { name: "b.tex", data: "much longer body" },
  ]);
  const { client } = sourceClient(gzipSync(tar));

  expect((await client.fetchSource("2101.01234")).file.name).toBe("b.tex");
});

it("parses a gzipped single file", async () => {
  const { client } = sourceClient(gzipSync("\\documentclass{article}"));

  expect((await client.fetchSource("2101.01234")).file.name).toBe("main.tex");
});

it("refuses an oversize download and a non-id", async () => {
  const big = sourceClient("x", { headers: { "content-length": "99999999" } });

  await expect(big.client.fetchSource("2101.01234")).rejects.toThrow(
    ArxivError,
  );
  await expect(big.client.fetchSource("https://evil.test/x")).rejects.toThrow(
    ArxivError,
  );
  expect(big.fetchFn).toHaveBeenCalledTimes(1);
});

it("refuses an oversize source file", async () => {
  const { client } = sourceClient(
    gzipSync("\\documentclass{x}" + "a".repeat(MAX_SOURCE_BYTES)),
  );

  await expect(client.fetchSource("2101.01234")).rejects.toThrow(ArxivError);
});

it("caches to disk and makes no second request", async () => {
  const dir = await mkdtemp(join(tmpdir(), "papers-"));
  const { client, fetchFn } = sourceClient(
    gzipSync("\\documentclass{x}\n\\section{A}\nhi % note\n"),
  );

  const first = await loadPaper(client, dir, "arXiv:math/0601001v2");
  const second = await loadPaper(client, dir, "math/0601001");

  expect(fetchFn).toHaveBeenCalledTimes(1);
  expect(second.tex).toBe(first.tex);
  expect(
    JSON.parse(
      await readFile(
        join(dir, ".lemmata/papers/math_0601001/meta.json"),
        "utf8",
      ),
    ),
  ).toMatchObject({ id: "math/0601001", file: "main.tex" });

  await loadPaper(client, dir, "math/0601001", { refresh: true });
  expect(fetchFn).toHaveBeenCalledTimes(2);
});

it("strips comments but keeps \\% and comment blocks go", () => {
  const tex =
    "50\\% of $x$ % gone\n\\\\% also gone\n\\begin{comment}\nno\n\\end{comment}\n\n\n\nend";

  expect(cleanTex(tex)).toBe("50\\% of $x$\n\\\\\n\nend");
});

it("finds sections and theorem anchors", () => {
  const tex =
    "\\section{Intro}\ntext\n\\subsection*{A {b} c}\n\\begin{theorem}[Elekes--Szabó]\nx\n\\end{theorem}\n\\section[short]{Last}";
  const sections = sectionsOf(tex);

  expect(sections.map((s) => s.title)).toEqual([
    "Intro",
    "A {b} c",
    "theorem (Elekes--Szabó)",
    "Last",
  ]);
  expect(sections[0]).toMatchObject({ index: 0, start: 0 });
  expect(sections[0]!.end).toBe(sections[1]!.start);
  expect(sections[3]!.end).toBe(tex.length);
});
