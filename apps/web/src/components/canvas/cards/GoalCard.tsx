import { Markdown } from "../../common/Markdown";
import { fieldsOf } from "../kinds";
import { Card, Header, StatusChip, type CardProps } from "./Card";

export function GoalCard({ node, status }: CardProps) {
  const p = fieldsOf(node);

  return (
    <Card
      status={status}
      className="w-80 border-[1.5px] border-lm-ink px-4 py-3.5"
    >
      <Header
        className="text-lm-ink"
        meta={p.author && `pinned by ${p.author}`}
      >
        Goal
      </Header>
      <div className="font-serif text-base leading-normal font-semibold">
        <Markdown inline>{p.title || "Untitled"}</Markdown>
      </div>
      {p.text && (
        <Markdown className="line-clamp-5 font-serif text-[15px] leading-normal italic">
          {p.text}
        </Markdown>
      )}
      <StatusChip status={status} />
    </Card>
  );
}
