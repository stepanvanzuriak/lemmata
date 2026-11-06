import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { grepSources } from "../../mcp/tools/searchLibraries.js";

it("returns matching source lines with module and line, up to the wanted count", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lemmata-grep-"));
  const a = join(dir, "A.lean");
  const b = join(dir, "B.lean");
  await writeFile(a, "theorem foo : True := by\n  push_cast\n  trivial\n");
  await writeFile(b, "-- push_cast here too\nexample : True := trivial\n");
  const files = [
    { module: "Mathlib.A", path: a },
    { module: "Mathlib.B", path: b },
  ];

  expect(await grepSources(files, /push_cast/, 5)).toEqual({
    lines: ["Mathlib.A:2: push_cast", "Mathlib.B:1: -- push_cast here too"],
    more: false,
  });
  expect(await grepSources(files, /push_cast/, 1)).toEqual({
    lines: ["Mathlib.A:2: push_cast"],
    more: true,
  });
});
