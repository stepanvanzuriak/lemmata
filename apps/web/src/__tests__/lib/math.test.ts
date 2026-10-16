import { expect, it } from "vitest";
import { normalizeMath } from "../../lib/math";

it("turns \\( \\) into inline math", () => {
  expect(normalizeMath("let \\(p = 5\\) be prime")).toBe(
    "let $p = 5$ be prime",
  );
});

it("turns \\[ \\] into a display fence", () => {
  expect(normalizeMath("\\[x^2\\]")).toBe("\n$$\nx^2\n$$\n");
});

it("turns a line holding only $$…$$ into a display fence", () => {
  expect(normalizeMath("intro\n  $$a + b$$  \nend")).toBe(
    "intro\n\n$$\na + b\n$$\n\nend",
  );
});

it("leaves $$ inside a sentence alone", () => {
  expect(normalizeMath("so $$x$$ holds")).toBe("so $$x$$ holds");
});
