import { Markdown } from "../../common/Markdown";
import { KIND_LABELS, paperOf } from "../kinds";
import { Card, Header, StatusChip, type CardProps } from "./Card";

const SHOWN_AUTHORS = 3;

function authorsLine(authors: string[]) {
  const shown = authors.slice(0, SHOWN_AUTHORS).join(", ");
  const rest = authors.length - SHOWN_AUTHORS;

  return rest > 0 ? `${shown} +${rest} more` : shown;
}

export function PaperCard({ node, status }: CardProps) {
  const p = paperOf(node);
  const year = p.published?.slice(0, 4);
  const sections = p.source?.sections.length;

  return (
    <Card status={status} className="w-80 gap-1.5 border-lm-line px-3.5 py-3">
      <Header className="text-lm-warn-ink" meta={year}>
        {KIND_LABELS.arxiv}
      </Header>
      <div className="text-[13px] leading-[1.4] font-medium">
        <Markdown inline>{p.title || "Untitled"}</Markdown>
      </div>
      {p.authors && p.authors.length > 0 && (
        <span
          className="truncate text-xs text-lm-muted"
          title={p.authors.join(", ")}
        >
          {authorsLine(p.authors)}
        </span>
      )}
      <div className="flex items-center gap-2 text-[11px] text-lm-muted">
        {p.url && (
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="nodrag nopan font-mono text-lm-accent-ink no-underline hover:underline"
          >
            arXiv:{p.arxivId}
          </a>
        )}
        {sections !== undefined && (
          <span className="ml-auto">
            {sections} {sections === 1 ? "section" : "sections"}
          </span>
        )}
      </div>
      <StatusChip status={status} />
    </Card>
  );
}
