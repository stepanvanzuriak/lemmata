import { Markdown } from "../../common/Markdown";
import { fieldsOf, KIND_LABELS } from "../kinds";
import { Card, Header, type CardProps } from "./Card";

export function MemoryCard({ node, status }: CardProps) {
  const p = fieldsOf(node);

  return (
    <Card status={status} className="w-80 gap-1.5 border-lm-line px-4 py-3">
      <Header className="text-lm-warn-ink">{KIND_LABELS.memory}</Header>
      <div className="text-[13px] leading-[1.45]">
        <Markdown inline>{p.title || "Untitled"}</Markdown>
      </div>
    </Card>
  );
}
