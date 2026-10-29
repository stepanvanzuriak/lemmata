import { expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildLeanIndex,
  describeHits,
  parseLeanFile,
  searchEntries,
  searchModules,
  searchRegex,
  type LeanIndex,
} from "../../search/leanIndex.js";
import { searchPython, type PythonEntry } from "../../search/pythonIndex.js";

const SOURCE = `/-!
# Natural subtraction
Facts about truncated subtraction.
-/
namespace Nat

/-- Cancelling an added term. -/
@[simp] protected theorem sub_add_cancel {n m : Nat} (h : m ≤ n) :
    n - m + m = n := by
  omega

/- theorem commented_out : True := trivial -/

section Foo
lemma helper (a : Nat) : a = a := rfl
end Foo

theorem _root_.Outer.thing : True := trivial
end Nat

def top := 1
`;

const fixture = async () => {
  const dir = await mkdtemp(join(tmpdir(), "lemmata-lean-index-"));

  await mkdir(join(dir, "Init"));
  await writeFile(join(dir, "Init", "Nat.lean"), SOURCE);
  return buildLeanIndex([{ dir }]);
};

const namesOf = (index: LeanIndex, hits: { id: number }[]) =>
  hits.map((h) => index.names[h.id]);

it("indexes Lean declarations with namespaces, docs and multi-line signatures", () => {
  const { entries } = parseLeanFile(SOURCE, "Init.Nat");

  expect(entries.map((e) => e.name)).toEqual([
    "Nat.sub_add_cancel",
    "Nat.helper",
    "Outer.thing",
    "top",
  ]);
  expect(entries[0]).toMatchObject({
    kind: "theorem",
    line: 8,
    doc: "Cancelling an added term.",
  });
  expect(entries[0]!.signature).toContain("n - m + m = n");
  expect(entries[1]!.kind).toBe("theorem");
});

it("finds Lean declarations by name words, regex and module docs", async () => {
  const index = await fixture();

  expect(namesOf(index, searchEntries(index, "sub add cancel"))[0]).toBe(
    "Nat.sub_add_cancel",
  );
  expect(namesOf(index, searchEntries(index, "Cancelling"))).toEqual([
    "Nat.sub_add_cancel",
  ]);
  expect(searchEntries(index, "nonexistent")).toEqual([]);
  expect(namesOf(index, searchRegex(index, /^Nat\.h/))).toEqual(["Nat.helper"]);
  expect(searchModules(index, "truncated subtraction")).toHaveLength(1);
});

it("shows full signatures and docs only for the hits it is asked about", async () => {
  const index = await fixture();
  const [hit] = searchEntries(index, "sub_add_cancel");
  const [entry] = await describeHits(index, [hit!.id]);

  expect(entry).toMatchObject({
    name: "Nat.sub_add_cancel",
    kind: "theorem",
    module: "Init.Nat",
    line: 8,
    doc: "Cancelling an added term.",
  });
  expect(entry!.signature).toContain("n - m + m = n");
});

it("ranks exact Python names first, public above private, docstring mentions last", () => {
  const entry = (name: string, doc = ""): PythonEntry => ({
    name,
    kind: "function",
    file: "x.py",
    line: 1,
    signature: "(n)",
    doc,
  });
  const hits = searchPython(
    [
      entry("lib._impl.factorint"),
      entry("lib.factorint", "Prime factors."),
      entry("lib.other", "Mentions factorint in passing."),
    ],
    "factorint",
  );

  expect(hits.map((h) => h.name)).toEqual([
    "lib.factorint",
    "lib._impl.factorint",
    "lib.other",
  ]);
});
