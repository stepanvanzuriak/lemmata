import { useMemo } from "react";
import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import "highlight.js/styles/github-dark.css";

hljs.registerLanguage("python", python);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("lean", () => ({
  name: "Lean",
  aliases: ["lean4"],
  keywords: {
    keyword:
      "import open namespace end section variable variables theorem lemma def abbrev example instance structure inductive class where by have let in do if then else match with fun forall exists sorry exact apply intro intros rw simp simpa ring omega linarith calc obtain cases induction constructor use assumption rfl decide native_decide noncomputable private protected opaque axiom deriving",
    literal: "true false True False",
    built_in: "Nat Int Rat Real Bool Prop Type Sort List Set Finset",
  },
  contains: [
    hljs.COMMENT("--", "$"),
    hljs.COMMENT("/-", "-/", { contains: ["self"] }),
    hljs.QUOTE_STRING_MODE,
    hljs.NUMBER_MODE,
  ],
}));

export function CodeBlock({
  source,
  language,
}: {
  source: string;
  language?: string;
}) {
  const highlighted = useMemo(
    () =>
      language && hljs.getLanguage(language)
        ? hljs.highlight(source, { language, ignoreIllegals: true }).value
        : null,
    [source, language],
  );

  return (
    <pre className="code-block m-0 max-w-full overflow-auto rounded-lg bg-lm-code p-3 font-mono text-xs leading-relaxed text-lm-code-fg">
      {highlighted === null ? (
        <code>{source}</code>
      ) : (
        <code
          className={`hljs language-${language}`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      )}
    </pre>
  );
}

export function CodeSection({
  source,
  language,
}: {
  source: string;
  language: string;
}) {
  return (
    <details className="min-w-0 rounded-lg border border-lm-line">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-lm-muted select-none">
        {language === "python" ? "Python" : "Lean"} code ·{" "}
        {source.split("\n").length} lines
        <span className="float-right" aria-hidden="true">
          ↕
        </span>
      </summary>
      <CodeBlock source={source} language={language} />
    </details>
  );
}
