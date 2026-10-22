import { Markdown } from "../../common/Markdown";
import { fieldsOf } from "../kinds";
import { Card, Header, Secondary, StatusChip, type CardProps } from "./Card";

export function HypothesisCard({ node, status }: CardProps) {
  const p = fieldsOf(node);

  return (
    <Card status={status} className="w-85 border-lm-line px-4 py-3.5">
      <Header className="text-lm-accent-ink">
        {p.label ? `${p.label} · hypothesis` : "Hypothesis"}
      </Header>
      <div className="text-sm leading-normal">
        <Markdown inline>{p.title || "Untitled"}</Markdown>
      </div>
      <Secondary>{p.text}</Secondary>
      <StatusChip status={status} />
    </Card>
  );
}
