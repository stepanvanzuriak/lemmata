import type { ReactNode } from "react";
import { Button } from "@heroui/react";
import { cardStatus, type CanvasNode, type Paper } from "shared";
import { useUpdateNode } from "../../api/canvases";
import { useChatStore } from "../../stores/chat";
import { Markdown } from "../common/Markdown";
import { StatusChip } from "./cards/CardBody";
import { literatureOf } from "./kinds";

const MAX_AUTHORS = 3;

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="m-0 text-[11px] font-semibold tracking-[0.06em] text-lm-muted uppercase">
        {label}
      </h3>
      {children}
    </section>
  );
}

function authorsOf(paper: Paper) {
  const shown = paper.authors.slice(0, MAX_AUTHORS).join(", ");
  return paper.authors.length > MAX_AUTHORS ? `${shown} et al.` : shown;
}

function PaperItem({
  paper,
  onToggle,
}: {
  paper: Paper;
  onToggle: VoidFunction;
}) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-lm-line bg-lm-surface px-3 py-2">
      <a
        href={paper.url}
        target="_blank"
        rel="noreferrer"
        className="text-sm leading-snug font-medium text-lm-accent-ink no-underline hover:underline"
      >
        <Markdown inline>{paper.title}</Markdown>
      </a>
      <span className="text-[11px] text-lm-muted">
        {authorsOf(paper)} · {paper.published.slice(0, 4)} ·{" "}
        <span className="font-mono">arXiv:{paper.id}</span>
      </span>
      {paper.relevance && (
        <Markdown className="text-xs leading-normal text-lm-ink2">
          {paper.relevance}
        </Markdown>
      )}
      <details className="text-xs text-lm-muted">
        <summary className="cursor-pointer select-none">Abstract</summary>
        <p className="m-0 mt-1 leading-normal">{paper.abstract}</p>
      </details>
      <Button size="sm" variant="ghost" className="self-end" onPress={onToggle}>
        {paper.dismissed ? "Restore" : "Dismiss"}
      </Button>
    </li>
  );
}

export function LiteraturePanel({
  canvasId,
  node,
}: {
  canvasId: string;
  node: CanvasNode;
}) {
  const send = useChatStore((state) => state.send);
  const updateNode = useUpdateNode(canvasId);
  const p = literatureOf(node);
  const papers = p.papers ?? [];
  const kept = papers.filter((paper) => !paper.dismissed);
  const dismissed = papers.filter((paper) => paper.dismissed);

  const toggle = (id: string) =>
    updateNode.mutate({
      id: node.id,
      patch: {
        papers: papers.map((paper) =>
          paper.id === id ? { ...paper, dismissed: !paper.dismissed } : paper,
        ),
      },
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={cardStatus(node, { nodes: [node], edges: [] })} />
        {p.checkedAt && (
          <span className="text-[11px] text-lm-muted">
            {kept.length} papers · checked {p.checkedAt.slice(0, 10)}
          </span>
        )}
        {send && (
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            onPress={() => send(`/literature ${node.id}`)}
          >
            {p.checkedAt ? "Re-check" : "Check now"}
          </Button>
        )}
      </div>

      {p.markdown && (
        <Markdown className="text-sm text-lm-ink2">{p.markdown}</Markdown>
      )}

      {p.suggestions && p.suggestions.length > 0 && (
        <Section label="Suggestions">
          <ul className="m-0 flex flex-col gap-1.5 pl-4">
            {p.suggestions.map((suggestion) => (
              <li key={suggestion} className="text-sm leading-normal">
                <Markdown inline>{suggestion}</Markdown>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {kept.length > 0 && (
        <Section label="Papers">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {kept.map((paper) => (
              <PaperItem
                key={paper.id}
                paper={paper}
                onToggle={() => toggle(paper.id)}
              />
            ))}
          </ul>
        </Section>
      )}

      {dismissed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-lm-muted select-none">
            Dismissed ({dismissed.length})
          </summary>
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0 opacity-70">
            {dismissed.map((paper) => (
              <PaperItem
                key={paper.id}
                paper={paper}
                onToggle={() => toggle(paper.id)}
              />
            ))}
          </ul>
        </details>
      )}

      {p.queries && p.queries.length > 0 && (
        <span className="text-[11px] text-lm-muted">
          Searched: {p.queries.map((q) => `“${q}”`).join(", ")}
        </span>
      )}
    </div>
  );
}
