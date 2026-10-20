import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import type { CanvasNode, NodeKind } from "shared";
import { CardBody } from "../../../components/canvas/cards/CardBody";

const KINDS: NodeKind[] = [
  "goal",
  "hypothesis",
  "statement",
  "note",
  "memory",
  "arxiv",
  "literature",
  "python",
  "lean",
];

const node = (kind: NodeKind) =>
  ({
    id: kind,
    canvasId: "c",
    kind,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    createdBy: "user",
    createdAt: "",
    updatedAt: "",
    payload: { title: "Sum $a^2 + b^2$", source: "print(1)" },
  }) as CanvasNode;

it.each(KINDS)("renders the %s title with math", (kind) => {
  const { container } = render(<CardBody node={node(kind)} />);

  expect(container.textContent).toContain("Sum");
  expect(container.querySelector(".katex")).not.toBeNull();
});

it("shows a literature card's kept papers and verdict", () => {
  const paper = (id: string, title: string, dismissed = false) => ({
    id,
    title,
    authors: ["A"],
    published: "2012-08-01",
    abstract: "",
    url: "",
    dismissed,
  });
  const card = {
    ...node("literature"),
    payload: {
      title: "Literature: H1",
      verdict: "partial",
      checkedAt: "2026-10-20T00:00:00Z",
      papers: [
        paper("1", "Few ordinary lines"),
        paper("2", "Dismissed paper", true),
      ],
    },
  } as CanvasNode;
  const { container } = render(
    <CardBody
      node={card}
      status={{ tone: "warn", label: "Partial results" }}
    />,
  );

  expect(container.textContent).toContain("2012 Few ordinary lines");
  expect(container.textContent).not.toContain("Dismissed paper");
  expect(container.textContent).toContain("Partial results");
  expect(container.textContent).toContain("checked 2026-10-20");
});
