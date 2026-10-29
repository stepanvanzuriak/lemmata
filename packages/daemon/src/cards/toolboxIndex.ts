export type ToolboxLanguage = "python" | "lean";

export type ToolboxEntry = {
  language: ToolboxLanguage;
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  signature: string;
  context: string[];
};

// Mask comments and strings without changing line positions. This is a source
// outline, not a parser or a proof of each declaration's independence.
function maskSource(source: string, language: ToolboxLanguage) {
  let result = "";
  let quote = "";
  let commentDepth = 0;
  for (let i = 0; i < source.length;) {
    const rest = source.slice(i);
    const char = source[i]!;
    if (commentDepth) {
      if (rest.startsWith("/-")) {
        commentDepth++;
        result += "  ";
        i += 2;
      } else if (rest.startsWith("-/")) {
        commentDepth--;
        result += "  ";
        i += 2;
      } else {
        result += char === "\n" ? "\n" : " ";
        i++;
      }
    } else if (quote) {
      if (char === "\\") {
        result += source[i + 1] === "\n" ? " \n" : "  ";
        i += 2;
      } else if (rest.startsWith(quote)) {
        result += " ".repeat(quote.length);
        i += quote.length;
        quote = "";
      } else {
        result += char === "\n" ? "\n" : " ";
        i++;
      }
    } else if (
      (language === "python" && char === "#") ||
      (language === "lean" && rest.startsWith("--"))
    ) {
      const end = source.indexOf("\n", i);
      const length = (end < 0 ? source.length : end) - i;
      result += " ".repeat(length);
      i += length;
    } else if (language === "lean" && rest.startsWith("/-")) {
      commentDepth = 1;
      result += "  ";
      i += 2;
    } else if (char === '"' || (language === "python" && char === "'")) {
      quote =
        language === "python" && rest.startsWith(char.repeat(3))
          ? char.repeat(3)
          : char;
      result += " ".repeat(quote.length);
      i += quote.length;
    } else {
      result += char;
      i++;
    }
  }
  return result;
}

export function indexToolbox(
  source: string,
  language: ToolboxLanguage,
): ToolboxEntry[] {
  const lines = source.split("\n");
  const masked = maskSource(source, language).split("\n");
  const entries: ToolboxEntry[] = [];
  const scopes: { name: string; namespace: boolean; source: string }[] = [];
  let active: ToolboxEntry | undefined;
  let prefix: number | undefined;
  let pythonDepth = 0;
  let pythonBackslash = false;

  const finish = (end: number) => {
    if (!active) {
      return;
    }
    while (end > active.startLine && !lines[end - 1]?.trim()) {
      end--;
    }
    active.endLine = end;
    active = undefined;
  };

  for (let i = 0; i < masked.length; i++) {
    const line = masked[i]!;
    if (!line.trim()) {
      continue;
    }
    if (language === "python") {
      const continued = pythonDepth > 0 || pythonBackslash;
      for (const char of line) {
        if ("([{".includes(char)) {
          pythonDepth++;
        }
        if (")]}".includes(char)) {
          pythonDepth--;
        }
      }
      pythonBackslash = line.trimEnd().endsWith("\\");
      // Methods and nested functions stay within their containing declaration.
      if (continued || /^\s/.test(line)) {
        continue;
      }
      finish(i);
      if (line.startsWith("@")) {
        prefix ??= i;
        continue;
      }
      const match = /^(?:async\s+)?(def|class)\s+([^\s(:[]+)/u.exec(line);
      if (match) {
        active = {
          language,
          name: match[2]!,
          kind: match[1]!,
          startLine: (prefix ?? i) + 1,
          endLine: lines.length,
          signature: lines[i]!.trim().slice(0, 240),
          context: [],
        };
        entries.push(active);
      }
      prefix = undefined;
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith("@[")) {
      finish(i);
      prefix ??= i;
    }
    const match =
      /^(?:@\[[^\]]*\]\s*)*(?:(?:private|protected|noncomputable|unsafe|partial)\s+)*(def|abbrev|theorem|lemma|structure|class|inductive|instance|axiom|opaque)\s+(«[^»]+»|[^\s(:{[=]+)/u.exec(
        trimmed,
      );
    const scope = /^(namespace|section)\b\s*(\S*)/u.exec(trimmed);
    const boundary =
      /^(?:end|import|open|export|variable|variables|universe|universes|set_option|attribute|include|omit|syntax|macro|elab|notation|infixl?|infixr|prefix|postfix|example|instance|#\w+)\b/u.test(
        trimmed,
      );
    if (match || scope || boundary) {
      finish(prefix ?? i);
    }
    if (scope) {
      scopes.push({
        name: scope[2] ?? "",
        namespace: scope[1] === "namespace",
        source: lines[i]!.trim(),
      });
    } else if (/^end\b/u.test(trimmed)) {
      scopes.pop();
    } else if (match) {
      const localName = match[2]!;
      // Anonymous instances have no retrievable declaration name.
      if (match[1] !== "instance" || ![":", "where"].includes(localName)) {
        const namespace = scopes.filter((s) => s.namespace).map((s) => s.name);
        active = {
          language,
          name: [...namespace, localName].join("."),
          kind: match[1]!,
          startLine: (prefix ?? i) + 1,
          endLine: lines.length,
          signature: lines[i]!.trim().slice(0, 240),
          context: scopes.map((s) => s.source),
        };
        entries.push(active);
      }
    }
    if (match || scope || boundary) {
      prefix = undefined;
    }
  }
  finish(lines.length);
  return entries;
}
