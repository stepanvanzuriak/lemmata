import type { ReactNode } from "react";
import { Button } from "@heroui/react";
import { cardStatus, type CanvasNode, type Paper } from "shared";
import { useAddPaper, useUpdateNode } from "../../api/canvases";
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
  onAdd,
  isAdded,
  isAdding,
}: {
  paper: Paper;
  onToggle: VoidFunction;
  onAdd: VoidFunction;
  isAdded: boolean;
  isAdding: boolean;
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
        <Markdown className="mt-1 leading-normal">{paper.abstract}</Markdown>
      </details>
      <div className="flex justify-end gap-1">
        <Button
          size="sm"
          variant="secondary"
          isDisabled={isAdded}
          isPending={isAdding}
          onPress={onAdd}
        >
          {isAdded ? "On canvas" : "Add to canvas"}
        </Button>
        <Button size="sm" variant="ghost" onPress={onToggle}>
          {paper.dismissed ? "Restore" : "Dismiss"}
        </Button>
      </div>
    </li>
  );
}

export function LiteraturePanel({
  canvasId,
  node,
  onCanvas,
}: {
  canvasId: string;
  node: CanvasNode;
  onCanvas: Set<string>;
}) {
  const send = useChatStore((state) => state.send);
  const updateNode = useUpdateNode(canvasId);
  const addPaper = useAddPaper(canvasId);
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

  const item = (paper: Paper) => (
    <PaperItem
      key={paper.id}
      paper={paper}
      onToggle={() => toggle(paper.id)}
      onAdd={() =>
        addPaper.mutate({ arxivId: paper.id, connectFrom: p.target ?? node.id })
      }
      isAdded={onCanvas.has(paper.id)}
      isAdding={addPaper.isPending && addPaper.variables?.arxivId === paper.id}
    />
  );

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
            {kept.map(item)}
          </ul>
        </Section>
      )}

      {dismissed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-lm-muted select-none">
            Dismissed ({dismissed.length})
          </summary>
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0 opacity-70">
            {dismissed.map(item)}
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
