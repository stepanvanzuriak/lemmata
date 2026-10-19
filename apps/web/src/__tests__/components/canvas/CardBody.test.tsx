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
