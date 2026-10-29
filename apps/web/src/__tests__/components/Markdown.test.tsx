import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { Markdown } from "../../components/common/Markdown";

const title = "Cauchy-Davenport in $\\mathbb{Z}_5$";

it("renders inline math without a paragraph wrapper", () => {
  const { container } = render(
    <h3>
      <Markdown inline>{title}</Markdown>
    </h3>,
  );

  expect(container.querySelector("p")).toBeNull();
  expect(container.querySelector(".katex")).not.toBeNull();
  expect(container.textContent).toContain("Cauchy-Davenport in");
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

it("highlights fenced code while escaping embedded HTML", () => {
  const { container } = render(
    <Markdown>
      {
        '```python\ndef check():\n    return "<img src=x onerror=alert(1)>"\n```'
      }
    </Markdown>,
  );
  expect(container.querySelector(".hljs-keyword")?.textContent).toBe("def");
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
});

it("preserves unknown code languages as plain text", () => {
  const { container } = render(<Markdown>{"```unknown\n<x>\n```"}</Markdown>);
  expect(container.querySelector("pre code")?.textContent).toBe("<x>");
  expect(container.querySelector("x")).toBeNull();
});
