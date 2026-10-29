import { normalizeMath, wrapBareMath } from "./math";

const SPECIAL: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
  $: "\\$",
  "<": "\\textless{}",
  ">": "\\textgreater{}",
};

export const escapeText = (text: string) =>
  text.replace(/[\\&%#_{}~^$<>]/g, (char) => SPECIAL[char]!);

function emphasis(text: string) {
  return escapeText(text)
    .replace(/\*\*(.+?)\*\*/g, "\\textbf{$1}")
    .replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, "\\emph{$1}")
    .replace(/~~(.+?)~~/g, "$1");
}

function links(text: string) {
  return text
    .split(/(\[[^\]]+\]\([^)\s]+\))/)
    .map((part, index) => {
      const match = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);

      if (index % 2 === 1 && match) {
        return `\\href{${match[2]!.replace(/[%#\\{}]/g, "\\$&")}}{${emphasis(match[1]!)}}`;
      }
      return emphasis(part);
    })
    .join("");
}

/** One line of prose: `$...$` math stays TeX, `code` becomes \texttt, the rest is escaped. */
export function inline(text: string | undefined) {
  if (!text) {
    return "";
  }

  return wrapBareMath(normalizeMath(text))
    .split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|`[^`]+`)/)
    .map((part, index) => {
      if (index % 2 === 0) {
        return links(part);
      }
      if (part.startsWith("`")) {
        return `\\texttt{${escapeText(part.slice(1, -1))}}`;
      }
      return part.startsWith("$$") ? `\\[${part.slice(2, -2).trim()}\\]` : part;
    })
    .join("");
}

export function verbatim(source: string) {
  const body = source.replace(/\\end\{verbatim\}/g, "\\end {verbatim}");

  return `\\begin{verbatim}\n${body.trimEnd()}\n\\end{verbatim}`;
}

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => inline(cell.trim()));

function table(rows: string[]) {
  const [head, , ...body] = rows;
  const header = cells(head!);

  return [
    `\\begin{center}\\begin{tabular}{${"l".repeat(header.length)}}`,
    "\\hline",
    `${header.map((c) => `\\textbf{${c}}`).join(" & ")} \\\\ \\hline`,
    ...body.map((row) => `${cells(row).join(" & ")} \\\\`),
    "\\hline",
    "\\end{tabular}\\end{center}",
  ];
}

/** The markdown cards hold, as LaTeX body text: paragraphs, lists, headings, quotes, code, tables and display math. */
export function markdownToTex(markdown: string | undefined) {
  if (!markdown?.trim()) {
    return "";
  }

  const lines = normalizeMath(markdown).replace(/\r/g, "").split("\n");
  const out: string[] = [];
  const paragraph: string[] = [];
  const lists: { ordered: boolean; indent: number }[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      out.push(inline(paragraph.join(" ")), "");
      paragraph.length = 0;
    }
  };
  const closeLists = (to = 0) => {
    while (lists.length > to) {
      out.push(`\\end{${lists.pop()!.ordered ? "enumerate" : "itemize"}}`);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const fence = line.match(/^\s*(```|~~~)/);

    if (fence) {
      flushParagraph();
      closeLists();
      const code: string[] = [];

      for (
        i++;
        i < lines.length && !lines[i]!.trimStart().startsWith(fence[1]!);
        i++
      ) {
        code.push(lines[i]!);
      }
      out.push(verbatim(code.join("\n")), "");
      continue;
    }

    if (line.trim() === "$$") {
      flushParagraph();
      closeLists();
      const math: string[] = [];

      for (i++; i < lines.length && lines[i]!.trim() !== "$$"; i++) {
        math.push(lines[i]!);
      }
      out.push(`\\[\n${math.join("\n").trim()}\n\\]`, "");
      continue;
    }

    if (TABLE_ROW.test(line) && TABLE_RULE.test(lines[i + 1] ?? "")) {
      flushParagraph();
      closeLists();
      const rows = [line];

      for (i++; i < lines.length && TABLE_ROW.test(lines[i]!); i++) {
        rows.push(lines[i]!);
      }
      i--;
      out.push(...table(rows), "");
      continue;
    }

    const heading = line.match(HEADING);

    if (heading) {
      flushParagraph();
      closeLists();
      out.push(`\\paragraph*{${inline(heading[2])}}`, "");
      continue;
    }

    const item = line.match(LIST_ITEM);

    if (item) {
      flushParagraph();
      const indent = item[1]!.length;
      const ordered = /\d/.test(item[2]!);

      while (lists.length > 0 && indent < lists.at(-1)!.indent) {
        closeLists(lists.length - 1);
      }
      if (lists.length === 0 || indent > lists.at(-1)!.indent) {
        lists.push({ ordered, indent });
        out.push(`\\begin{${ordered ? "enumerate" : "itemize"}}`);
      }
      out.push(`\\item ${inline(item[3])}`);
      continue;
    }

    if (lists.length > 0 && /^\s+\S/.test(line)) {
      out.push(inline(line.trim()));
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      closeLists();
      continue;
    }

    if (/^\s*>/.test(line)) {
      flushParagraph();
      closeLists();
      const quote: string[] = [];

      for (; i < lines.length && /^\s*>/.test(lines[i]!); i++) {
        quote.push(lines[i]!.replace(/^\s*>\s?/, ""));
      }
      i--;
      out.push(
        "\\begin{quote}",
        markdownToTex(quote.join("\n")),
        "\\end{quote}",
        "",
      );
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph();
      closeLists();
      out.push("\\medskip\\hrule\\medskip", "");
      continue;
    }

    closeLists();
    paragraph.push(line.trim());
  }

  flushParagraph();
  closeLists();

  return out.join("\n").trim();
}
