import ReactMarkdown, { type Options } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { normalizeMath } from "../lib/math";

const remarkPlugins: Options["remarkPlugins"] = [remarkMath];
const rehypePlugins: Options["rehypePlugins"] = [
  [rehypeKatex, { throwOnError: false, errorColor: "var(--color-lm-danger)" }],
];

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
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      disallowedElements={inline ? ["p"] : undefined}
      unwrapDisallowed
    >
      {normalizeMath(children)}
    </ReactMarkdown>
  );

  if (inline) {
    return <span className={className}>{content}</span>;
  }

  return <div className={`markdown ${className ?? ""}`}>{content}</div>;
}
