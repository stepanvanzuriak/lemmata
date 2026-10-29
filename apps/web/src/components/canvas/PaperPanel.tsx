import { Button } from "@heroui/react";
import type { CanvasNode } from "shared";
import { useFetchPaperSource } from "../../api/canvases";
import { ErrorNote } from "../common/State";
import { Markdown } from "../common/Markdown";
import { paperOf } from "./kinds";

export function PaperPanel({
  canvasId,
  node,
}: {
  canvasId: string;
  node: CanvasNode;
}) {
  const fetchSource = useFetchPaperSource(canvasId);
  const p = paperOf(node);
  const source = p.source;

  return (
    <div className="flex flex-col gap-3">
      {p.authors && p.authors.length > 0 && (
        <span className="text-xs text-lm-muted">
          {p.authors.join(", ")}
          {p.published && ` · ${p.published.slice(0, 4)}`}
        </span>
      )}
      {p.abstract && (
        <Markdown className="text-sm text-lm-ink2">{p.abstract}</Markdown>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {p.url && (
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-lm-accent-ink no-underline hover:underline"
          >
            arXiv:{p.arxivId}
          </a>
        )}
        <Button
          size="sm"
          variant={source ? "secondary" : "primary"}
          className="ml-auto"
          isPending={fetchSource.isPending}
          onPress={() => fetchSource.mutate(node.id)}
        >
          {source ? "Re-fetch" : "Fetch source"}
        </Button>
      </div>
      {fetchSource.isError && <ErrorNote error={fetchSource.error} />}
      {source ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-lm-muted">
            Source fetched {source.fetchedAt.slice(0, 10)} ·{" "}
            {Math.ceil(source.bytes / 1024)} KB · the arXiv submission, which
            can differ from the published version
          </span>
          {source.sections.length > 0 ? (
            <ol className="m-0 flex list-none flex-col gap-0.5 p-0 text-xs">
              {source.sections.map(({ index, title }) => (
                <li key={index} className="truncate">
                  <span className="mr-1.5 font-mono text-lm-muted">
                    {index}
                  </span>
                  <Markdown inline>{title}</Markdown>
                </li>
              ))}
            </ol>
          ) : (
            <span className="text-xs text-lm-muted">
              No sections found in the source.
            </span>
          )}
        </div>
      ) : (
        <span className="text-xs text-lm-muted">
          Only the abstract is on the canvas. Fetch the source so agents can
          read the paper with read_paper.
        </span>
      )}
    </div>
  );
}
