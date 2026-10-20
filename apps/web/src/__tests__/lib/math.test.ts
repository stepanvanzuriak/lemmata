import { expect, it } from "vitest";
import { normalizeMath, wrapBareMath } from "../../lib/math";

it("turns \\( \\) into inline math", () => {
  expect(normalizeMath("let \\(p = 5\\) be prime")).toBe(
    "let $p = 5$ be prime",
  );
});

it("turns \\[ \\] into a display fence", () => {
  expect(normalizeMath("\\[x^2\\]")).toBe("\n$$\nx^2\n$$\n");
});

it("turns a line holding only $$...$$ into a display fence", () => {
  expect(normalizeMath("intro\n  $$a + b$$  \nend")).toBe(
    "intro\n\n$$\na + b\n$$\n\nend",
  );
});

it("leaves $$ inside a sentence alone", () => {
  expect(normalizeMath("so $$x$$ holds")).toBe("so $$x$$ holds");
});

it.each([
  [
    "Melchior bound: f_k(n) <= n(n-1)/(k(k-1)+2(k-3))",
    "Melchior bound: $f_k(n) \\le n(n-1)/(k(k-1)+2(k-3))$",
  ],
  [
    "Denniston arcs: n^2/12 four-rich lines over F_{2^h}",
    "Denniston arcs: $n^2/12$ four-rich lines over $F_{2^h}$",
  ],
  [
    "No: f_k(n)=Omega(n^2) via explicit construction",
    "No: $f_k(n)=\\Omega(n^2)$ via explicit construction",
  ],
  [
    "Erdős 588: rich lines with no k+1 collinear",
    "Erdős 588: rich lines with no $k+1$ collinear",
  ],
  ["Is $f_k(n)=o(n^2)$, really?", "Is $f_k(n)=o(n^2)$, really?"],
  [
    "H5: duality (proved) and four-rich lines",
    "H5: duality (proved) and four-rich lines",
  ],
  [
    "Sylvester-Gallai theorems / a survey",
    "Sylvester-Gallai theorems / a survey",
  ],
  ["bound is n^2, not more", "bound is $n^2$, not more"],
  ["call `f_k(n)` here", "call `f_k(n)` here"],
])("wraps bare math in %j", (input, output) => {
  expect(wrapBareMath(input)).toBe(output);
});
