import { expect, it } from "vitest";
import type { CanvasDetail, CanvasNode } from "shared";
import { canvasToLatex } from "../../lib/latex";

const node = (
  id: string,
  kind: CanvasNode["kind"],
  payload: object,
): CanvasNode =>
  ({
    id,
    kind,
    canvasId: "c",
    x: 0,
    y: 0,
    createdAt: id,
    payload,
  }) as CanvasNode;

const detail = {
  canvas: { title: "Sums & squares" },
  nodes: [
    node("1", "goal", {
      title: "Prove it",
      text: "Show $n^2 \\ge 0$ for 50%.",
      status: "open",
    }),
    node("2", "hypothesis", {
      title: "H one",
      label: "H1",
      status: "supported",
      markdown:
        "## Proof\n\nBy **induction**:\n\n- base $n=1$\n- step\n\n$$\\sum_i i = n$$\n\n```py\nx = 1\n```",
    }),
    node("3", "hypothesis", {
      title: "Gone",
      label: "H2",
      archived: { at: "x" },
    }),
    node("4", "python", { title: "Check", source: "print(1)" }),
  ],
  edges: [],
} as unknown as CanvasDetail;

it("exports current cards, keeps math and escapes text", () => {
  const tex = canvasToLatex(detail, new Date("2026-01-02"));

  expect(tex).toContain("\\title{Sums \\& squares}");
  expect(tex).toContain("$n^2 \\ge 0$ for 50\\%.");
  expect(tex).toContain("\\begin{hypothesis}[H one; H1]");
  expect(tex).toContain("Status: Supported");
  expect(tex).toContain("\\begin{verbatim}\nprint(1)");
  expect(tex).toContain("\\paragraph*{Proof}");
  expect(tex).toContain("By \\textbf{induction}:");
  expect(tex).toContain(
    "\\begin{itemize}\n\\item base $n=1$\n\\item step\n\\end{itemize}",
  );
  expect(tex).toContain("\\[\n\\sum_i i = n\n\\]");
  expect(tex).toContain("\\begin{verbatim}\nx = 1");
  expect(tex).not.toContain("Gone");
  expect(tex.trimEnd().endsWith("\\end{document}")).toBe(true);
});
