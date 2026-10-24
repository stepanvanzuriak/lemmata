import { AttackCard } from "./AttackCard";
import type { CardProps } from "./Card";
import { CodeCard } from "./CodeCard";
import { DefaultCard } from "./DefaultCard";
import { GoalCard } from "./GoalCard";
import { HypothesisCard } from "./HypothesisCard";
import { LiteratureCard } from "./LiteratureCard";
import { MemoryCard } from "./MemoryCard";
import { NoteCard } from "./NoteCard";
import { PaperCard } from "./PaperCard";
import { ToolboxCard } from "./ToolboxCard";

export { StatusChip } from "./Card";

export function CardBody(props: CardProps) {
  switch (props.node.kind) {
    case "goal":
      return <GoalCard {...props} />;
    case "hypothesis":
      return <HypothesisCard {...props} />;
    case "attack":
      return <AttackCard {...props} />;
    case "python":
    case "lean":
      return <CodeCard {...props} />;
    case "literature":
      return <LiteratureCard {...props} />;
    case "note":
      return <NoteCard {...props} />;
    case "memory":
      return <MemoryCard {...props} />;
    case "toolbox":
      return <ToolboxCard {...props} />;
    case "arxiv":
      return <PaperCard {...props} />;
    default:
      return <DefaultCard {...props} />;
  }
}
