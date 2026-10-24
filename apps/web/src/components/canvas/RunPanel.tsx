import { useState } from "react";
import { Button, Modal, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import type { CanvasNode, CardFigure } from "shared";
import { useRunNode } from "../../api/canvases";
import { Figure } from "./Figure";
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

type Mode = "view" | "angles";

function FigureItem({
  nodeId,
  runAt,
  figure,
}: {
  nodeId: string;
  runAt: string;
  figure: CardFigure;
}) {
  const [mode, setMode] = useState<Mode>("view");
  const [open, setOpen] = useState(false);
  const name = mode === "angles" && figure.views ? figure.views : figure.name;
  const alt = figure.title ?? "Figure";

  return (
    <figure className="m-0 flex flex-col gap-1.5">
      {figure.is3d && figure.views && (
        <ToggleButtonGroup
          aria-label="3D view"
          size="sm"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[mode]}
          onSelectionChange={(keys) => {
            const [key] = keys;
            if (key) {
              setMode(key as Mode);
            }
          }}
        >
          <ToggleButton id="view">View</ToggleButton>
          <ToggleButton id="angles">4 angles</ToggleButton>
        </ToggleButtonGroup>
      )}
      <button
        type="button"
        aria-label={`Open ${alt} full size`}
        className="cursor-zoom-in overflow-hidden rounded-lg border border-lm-line p-0"
        onClick={() => setOpen(true)}
      >
        <Figure
          nodeId={nodeId}
          name={name}
          runAt={runAt}
          alt={alt}
          className="max-h-72 w-full"
        />
      </button>
      {figure.title && (
        <figcaption className="text-xs text-lm-muted">
          {figure.title}
        </figcaption>
      )}
      <Modal.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Modal.Container size="cover">
          <Modal.Dialog aria-label={alt}>
            <Modal.CloseTrigger />
            <Modal.Body className="flex items-center justify-center bg-white">
              <Figure
                nodeId={nodeId}
                name={name}
                runAt={runAt}
                alt={alt}
                className="max-h-full max-w-full"
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </figure>
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
          {run.figures && run.figures.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold tracking-[0.06em] text-lm-muted uppercase">
                Figures
              </span>
              {run.figures.map((figure) => (
                <FigureItem
                  key={figure.name}
                  nodeId={node.id}
                  runAt={run.runAt}
                  figure={figure}
                />
              ))}
            </div>
          )}
          <Output label="stdout" text={run.output.stdout} />
          <Output label="stderr" text={run.output.stderr} />
        </>
      )}
    </section>
  );
}
