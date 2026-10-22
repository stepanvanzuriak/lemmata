import { gzipSync } from "node:zlib";
import { createTar } from "nanotar";
import { expect, it } from "vitest";
import { unpackSource } from "../arxiv/source.js";

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
