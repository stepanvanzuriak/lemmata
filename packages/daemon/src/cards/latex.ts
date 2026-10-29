import katex from "katex";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { ToolRefusal, type CardFields } from "./types.js";

type MarkdownNode = {
  type: string;
  position?: { start: { offset?: number }; end: { offset?: number } };
  children?: MarkdownNode[];
};

const markdown = unified().use(remarkParse);
const delimiters = [
  ["$$", "$$"],
  ["$", "$"],
  ["\\[", "\\]"],
  ["\\(", "\\)"],
] as const;

function escaped(text: string, offset: number): boolean {
  let slashes = 0;
  while (offset > 0 && text[--offset] === "\\") {
    slashes++;
  }
  return slashes % 2 === 1;
}

/** Check rendered prose, leaving code examples and executable fields alone. */
export function validateCardLatex(fields: CardFields): void {
  for (const field of ["title", "text", "markdown"] as const) {
    const text = fields[field];
    if (!text) {
      continue;
    }

    const code = new Map<number, number>();
    const visit = (node: MarkdownNode) => {
      if (node.type === "code" || node.type === "inlineCode") {
        const start = node.position?.start.offset;
        const end = node.position?.end.offset;
        if (start !== undefined && end !== undefined) {
          code.set(start, end);
        }
      } else if ("children" in node) {
        for (const child of node.children ?? []) {
          visit(child);
        }
      }
    };
    visit(markdown.parse(text));

    const fail = (reason: string): never => {
      throw new ToolRefusal(
        `Invalid LaTeX in ${field} of card "${fields.title ?? "Untitled"}": ${reason}. Fix the math and retry the call.`,
      );
    };

    for (let i = 0; i < text.length;) {
      const codeEnd = code.get(i);
      if (codeEnd !== undefined) {
        i = codeEnd;
        continue;
      }
      if (escaped(text, i)) {
        i++;
        continue;
      }
      const delimiter = delimiters.find(([open]) => text.startsWith(open, i));
      if (!delimiter) {
        if (text.startsWith("\\]", i) || text.startsWith("\\)", i)) {
          fail("closing math delimiter without an opening delimiter");
        }
        i++;
        continue;
      }
      const [open, close] = delimiter;
      const start = i + open.length;
      let end = start;
      for (; end < text.length; end++) {
        if (text.startsWith(close, end) && !escaped(text, end)) {
          break;
        }
      }
      if (end === text.length) {
        fail(`unclosed ${open} math delimiter`);
      }
      const tex = text.slice(start, end);
      if (!tex.trim()) {
        fail("empty math expression");
      }
      try {
        katex.renderToString(tex, {
          displayMode: open === "$$" || open === "\\[",
          throwOnError: true,
          strict: "ignore",
          trust: false,
        });
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
      }
      i = end + close.length;
    }
  }
}
