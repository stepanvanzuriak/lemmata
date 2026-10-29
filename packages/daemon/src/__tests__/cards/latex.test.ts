import { expect, it } from "vitest";
import { validateCardLatex } from "../../cards/latex.js";

it.each([
  "$\\frac{1}{$",
  "$\\notARealCommand{x}$",
  "$$\\begin{aligned}x &= 1\\end{matrix}$$",
  "An unclosed $x",
  "An unclosed $$x",
  "An unclosed \\(x",
  "An unclosed \\[x",
  "Unexpected \\]",
  "Empty $$ $$",
])("rejects broken math: %s", (text) => {
  expect(() => validateCardLatex({ title: "Lemma", text })).toThrow(
    'Invalid LaTeX in text of card "Lemma"',
  );
});

it.each(["title", "text", "markdown"] as const)(
  "validates math in %s",
  (field) => {
    expect(() => validateCardLatex({ [field]: "$\\frac{1}{$" })).toThrow(
      `Invalid LaTeX in ${field}`,
    );
  },
);

it("accepts supported delimiters, prose, code examples and escaped dollars", () => {
  expect(() =>
    validateCardLatex({
      title: "A bound on $x^2$",
      text: "Cost: \\$5. Inline \\(\\alpha + 1\\).",
      markdown: [
        "Prose with **emphasis** and $\\frac{a}{b}$.",
        "$$\n\\begin{aligned}x &= 1 \\\\ y &= 2\\end{aligned}\n$$",
        "\\[\\sum_{i=1}^n i\\]",
        "`$\\invalid`",
        "```latex\n$\\invalid\n```",
        "",
        "    $\\invalid",
      ].join("\n\n"),
      source: "$\\invalid",
      python: "$\\invalid",
      lean: "$\\invalid",
    }),
  ).not.toThrow();
});
