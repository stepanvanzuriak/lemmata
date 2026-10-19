import { Button } from "@heroui/react";
import type { CanvasNode } from "shared";
import { useRunNode } from "../../api/canvases";
import { fieldsOf } from "./kinds";

function Output({ label, text }: { label: string; text: string }) {
  if (!text.trim()) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-[0.06em] text-lm-muted uppercase">
        {label}
      </span>
      <pre className="m-0 max-h-64 overflow-auto rounded-lg bg-lm-code p-3 font-mono text-xs leading-normal whitespace-pre-wrap text-lm-code-fg">
        {text}
      </pre>
    </div>
  );
}

export function RunPanel({
  canvasId,
  node,
}: {
  canvasId: string;
  node: CanvasNode;
}) {
  const runNode = useRunNode(canvasId);
  const { run } = fieldsOf(node);

  return (
    <section className="flex flex-col gap-3" aria-label="Run">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          isPending={runNode.isPending}
          onPress={() => runNode.mutate(node.id)}
        >
          {run ? "Run again" : "Run"}
        </Button>
        {run && (
          <span
            className={
              run.ok ? "text-xs text-lm-ok-ink" : "text-xs text-lm-danger"
            }
          >
            {run.badge}
          </span>
        )}
      </div>
      <p className="m-0 text-[11px] text-lm-muted">
        Runs as you, in the project folder. Not a sandbox.
      </p>
      {run && (
        <>
          {run.diagnostics?.map((d, index) => (
            <div
              key={index}
              className="rounded-lg border border-lm-line px-3 py-2 font-mono text-xs whitespace-pre-wrap"
            >
              <span
                className={
                  d.severity === "error" ? "text-lm-danger" : "text-lm-warn-ink"
                }
              >
                {d.line}:{d.column} {d.severity}
              </span>{" "}
              {d.message}
            </div>
          ))}
          {run.axioms && run.axioms.length > 0 && (
            <div className="text-xs text-lm-muted">
              Axioms: <span className="font-mono">{run.axioms.join(", ")}</span>
            </div>
          )}
          <Output label="stdout" text={run.output.stdout} />
          <Output label="stderr" text={run.output.stderr} />
        </>
      )}
    </section>
  );
}
