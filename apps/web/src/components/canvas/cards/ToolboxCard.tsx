import { Markdown } from "../../common/Markdown";
import { fieldsOf } from "../kinds";
import { Card, Header, Secondary, type CardProps } from "./Card";

export function ToolboxCard({ node }: CardProps) {
  const p = fieldsOf(node);
  const snippets = [
    p.python?.trim() && { label: "Python", source: p.python },
    p.lean?.trim() && { label: "Lean", source: p.lean },
  ].filter((snippet): snippet is { label: string; source: string } =>
    Boolean(snippet),
  );

  return (
    <Card className="w-75 gap-0 overflow-hidden border-lm-line">
      <Header className="border-b border-lm-hair px-3.5 py-2.5 text-lm-accent">
        Toolbox
      </Header>
      <div className="px-3.5 pt-2 font-serif text-[15px]">
        <Markdown inline>{p.title || "Toolbox"}</Markdown>
      </div>
      {p.text && (
        <div className="px-3.5 pt-1 pb-2">
          <Secondary>{p.text}</Secondary>
        </div>
      )}
      {snippets.length ? (
        snippets.map(({ label, source }) => (
          <section key={label} className="border-t border-lm-hair">
            <div className="px-3.5 pt-2 text-[10px] font-semibold text-lm-muted uppercase">
              {label}
            </div>
            <pre className="m-0 max-h-24 overflow-hidden px-3.5 py-1.5 font-mono text-[10px] whitespace-pre-wrap text-lm-code-fg">
              {source}
            </pre>
          </section>
        ))
      ) : (
        <div className="px-3.5 py-2 text-xs text-lm-muted">No snippets yet</div>
      )}
    </Card>
  );
}
