import { Children, isValidElement, type ReactNode } from "react";
import { CodeBlock } from "./CodeBlock";
import ReactMarkdown, { type Options } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { normalizeMath, wrapBareMath } from "../../lib/math";

const remarkPlugins: Options["remarkPlugins"] = [remarkMath];
const rehypePlugins: Options["rehypePlugins"] = [
  [rehypeKatex, { throwOnError: false, errorColor: "var(--color-lm-danger)" }],
];

function MarkdownPre({ children }: { children?: ReactNode }) {
  const code = Children.toArray(children)[0];
  if (!isValidElement<{ children?: string; className?: string }>(code)) {
    return <pre>{children}</pre>;
  }
  const language = /language-([\w+-]+)/.exec(code.props.className ?? "")?.[1];
  return (
    <CodeBlock
      source={String(code.props.children ?? "").replace(/\n$/, "")}
      language={language}
    />
  );
}

const components: Options["components"] = { pre: MarkdownPre };

export function Markdown({
  children,
  inline = false,
  className,
}: {
  children: string;
  inline?: boolean;
  className?: string;
}) {
  const content = (
    <ReactMarkdown
      components={components}
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      disallowedElements={inline ? ["p"] : undefined}
      unwrapDisallowed
    >
      {/* Titles and other one-liners often carry math without $...$ */}
      {inline ? wrapBareMath(normalizeMath(children)) : normalizeMath(children)}
    </ReactMarkdown>
  );

  if (inline) {
    return (
      <span className={`markdown-inline ${className ?? ""}`}>{content}</span>
    );
  }

  return <div className={`markdown ${className ?? ""}`}>{content}</div>;
}
