import { Markdown } from "../../common/Markdown";
import { fieldsOf, KIND_LABELS } from "../kinds";
import { Card, Header, Secondary, StatusChip, type CardProps } from "./Card";

export function DefaultCard({ node, status }: CardProps) {
  const p = fieldsOf(node);

  return (
    <Card status={status} className="w-75 border-lm-line px-4 py-3.5">
      <Header className="text-lm-muted">{KIND_LABELS[node.kind]}</Header>
      <div className="font-serif text-[15px] leading-normal">
        <Markdown inline>{p.title || "Untitled"}</Markdown>
      </div>
      <Secondary>{p.text}</Secondary>
      <StatusChip status={status} />
    </Card>
  );
}
