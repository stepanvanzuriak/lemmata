import clsx from "clsx";
import { Markdown } from "../../common/Markdown";
import { Figure } from "../Figure";
import { fieldsOf } from "../kinds";
import { Card, Header, StatusChip, type CardProps } from "./Card";

export function CodeCard({ node, status }: CardProps) {
  const p = fieldsOf(node);
  const lastLine = (p.run?.output.stdout || p.run?.output.stderr || "")
    .trim()
    .split("\n")
    .at(-1);
  const isPython = node.kind === "python";
  const figures = p.run?.figures ?? [];

  return (
    <Card
      status={status}
      className="w-72.5 gap-0 overflow-hidden border-lm-line"
    >
      <Header
        className={clsx(
          "border-b border-lm-hair px-3.5 py-2.5",
          isPython ? "text-lm-teal-ink" : "text-lm-muted",
        )}
        meta={
          <Markdown inline className="font-mono">
            {p.title || ""}
          </Markdown>
        }
      >
        {isPython ? "Python" : "Lean check"}
      </Header>
      <pre className="m-0 max-h-40 overflow-hidden bg-lm-code px-3.5 py-2.5 font-mono text-[11.5px] leading-[1.6] whitespace-pre-wrap text-lm-code-fg">
        {p.source || " "}
      </pre>
      {figures.length > 0 && (
        <div className="flex flex-col border-t border-lm-hair">
          <Figure
            nodeId={node.id}
            name={figures[0]!.name}
            runAt={p.run!.runAt}
            alt={figures[0]!.title ?? "Figure"}
            className="max-h-40 w-full"
          />
          {figures.length > 1 && (
            <span className="px-3.5 py-1 text-[11px] text-lm-muted">
              +{figures.length - 1} more
            </span>
          )}
        </div>
      )}
      <div className="flex min-w-0 items-center gap-2 px-3.5 py-2">
        <StatusChip status={status} />
        {lastLine && (
          <span className="min-w-0 truncate font-mono text-[11px] text-lm-muted">
            {lastLine}
          </span>
        )}
      </div>
    </Card>
  );
}
