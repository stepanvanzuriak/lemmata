import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { Markdown } from "../../components/Markdown";

const title = "Cauchy–Davenport in $\\mathbb{Z}_5$";

it("renders inline math without a paragraph wrapper", () => {
  const { container } = render(
    <h3>
      <Markdown inline>{title}</Markdown>
    </h3>,
  );

  expect(container.querySelector("p")).toBeNull();
  expect(container.querySelector(".katex")).not.toBeNull();
  expect(container.textContent).toContain("Cauchy–Davenport in");
});

it("renders markdown blocks and display math", () => {
  const { container } = render(
    <Markdown>{"Intro **bold**\n\n$$x^2$$\n\n- one\n- two"}</Markdown>,
  );

  expect(container.querySelector("strong")?.textContent).toBe("bold");
  expect(container.querySelector(".katex-display")).not.toBeNull();
  expect(container.querySelectorAll("li")).toHaveLength(2);
});

it("shows malformed TeX as red source instead of throwing", () => {
  const { container } = render(<Markdown>{"broken $\\frac{1}{$"}</Markdown>);
  const error = container.querySelector<HTMLElement>(".katex-error");

  expect(error?.textContent).toBe("\\frac{1}{");
  expect(error?.style.color).toBe("var(--color-lm-danger)");
});

it("escapes HTML in the text", () => {
  const { container } = render(
    <Markdown>{"<img src=x onerror=alert(1)>"}</Markdown>,
  );

  expect(container.querySelector("img")).toBeNull();
});
