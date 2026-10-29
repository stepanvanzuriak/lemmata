import { expect, it } from "vitest";
import { indexToolbox } from "../../cards/toolboxIndex.js";

it("outlines Python declarations without indexing strings, methods or nested functions", () => {
  const source = `import functools
text = """
def fake():
    pass
"""
@functools.cache
def square(x):
    """Square a number."""
    def inner():
        return x * x
    return inner()

class Box:
    def method(self):
        return 1

async def fetch():
    return 2

VALUE = 3`;
  const entries = indexToolbox(source, "python");
  expect(entries.map((e) => e.name)).toEqual(["square", "Box", "fetch"]);
  const read = (index: number) => {
    const e = entries[index]!;
    return source
      .split("\n")
      .slice(e.startLine - 1, e.endLine)
      .join("\n");
  };
  expect(read(0)).toBe(`@functools.cache
def square(x):
    """Square a number."""
    def inner():
        return x * x
    return inner()`);
  expect(read(1)).toBe(`class Box:
    def method(self):
        return 1`);
  expect(read(2)).toBe("async def fetch():\n    return 2");
});

it("outlines Lean namespace declarations and attributes, respecting nested comments and command boundaries", () => {
  const source = `import Mathlib
/- outer
/- nested -/
theorem fake : True := by trivial
-/
namespace Tools
section Local
variable (n : Nat)
@[simp]
theorem identity : n = n := by
  rfl

def text := "def fake := 2"
end Local
namespace Inner
private def twice (n : Nat) := n + n
end Inner
instance : Inhabited Nat := ⟨0⟩
end Tools
def outside := 1`;
  const entries = indexToolbox(source, "lean");
  expect(entries.map((e) => e.name)).toEqual([
    "Tools.identity",
    "Tools.text",
    "Tools.Inner.twice",
    "outside",
  ]);
  expect(entries[0]!.context).toEqual(["namespace Tools", "section Local"]);
  const first = entries[0]!;
  expect(
    source
      .split("\n")
      .slice(first.startLine - 1, first.endLine)
      .join("\n"),
  ).toBe("@[simp]\ntheorem identity : n = n := by\n  rfl");
  expect(
    source.split("\n").slice(entries[2]!.startLine - 1, entries[2]!.endLine),
  ).toEqual(["private def twice (n : Nat) := n + n"]);
});

it("keeps multiline Python decorators and signatures with their function", () => {
  const source = `@decorate(
    value=1,
)
def example(
    n: int,
):
    return n

def next_one():
    return 0`;
  const entries = indexToolbox(source, "python");
  expect(entries.map((e) => e.name)).toEqual(["example", "next_one"]);
  expect(entries[0]).toMatchObject({ startLine: 1, endLine: 7 });
});
