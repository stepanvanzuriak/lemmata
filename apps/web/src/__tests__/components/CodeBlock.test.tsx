import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { CodeSection } from "../../components/common/CodeBlock";

it("keeps toolbox code collapsed until expanded and highlights Lean", () => {
  const { container } = render(
    <CodeSection language="lean" source="theorem test : True := by trivial" />,
  );
  const details = container.querySelector("details")!;
  expect(details.open).toBe(false);
  fireEvent.click(screen.getByText(/Lean code/));
  expect(details.open).toBe(true);
  expect(container.querySelector(".hljs-keyword")?.textContent).toBe("theorem");
});
