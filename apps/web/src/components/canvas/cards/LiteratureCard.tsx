import { Markdown } from "../../common/Markdown";
import { KIND_LABELS, literatureOf } from "../kinds";
import { Card, Header, StatusChip, type CardProps } from "./Card";

const SHOWN_PAPERS = 3;

export function LiteratureCard({ node, status }: CardProps) {
  const p = literatureOf(node);
  const papers = (p.papers ?? []).filter((paper) => !paper.dismissed);

  return (
    <Card status={status} className="w-80 gap-1.5 border-lm-line px-3.5 py-3">
      <Header
        className="text-lm-warn-ink"
        meta={p.checkedAt && `checked ${p.checkedAt.slice(0, 10)}`}
      >
        {KIND_LABELS.literature}
      </Header>
      <div className="text-[13px] leading-[1.4] font-medium">
        <Markdown inline>{p.title || "Literature check"}</Markdown>
      </div>
      {papers.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {papers.slice(0, SHOWN_PAPERS).map((paper) => (
            <li
              key={paper.id}
              className="truncate text-xs leading-normal text-lm-ink2"
              title={paper.title}
            >
              <span className="font-mono text-[11px] text-lm-muted">
                {paper.published.slice(0, 4)}
              </span>{" "}
              <Markdown inline>{paper.title}</Markdown>
            </li>
          ))}
          {papers.length > SHOWN_PAPERS && (
            <li className="text-[11px] text-lm-muted">
              +{papers.length - SHOWN_PAPERS} more
            </li>
          )}
        </ul>
      )}
      {!p.checkedAt && (
        <span className="text-xs text-lm-muted">Not checked yet</span>
      )}
      <StatusChip status={status} />
    </Card>
  );
}
