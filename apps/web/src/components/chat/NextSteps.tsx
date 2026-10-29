import { Button } from "@heroui/react";
import type { CanvasDetail, ChatMessage, UpdateNodeRequest } from "shared";
import {
  useFetchPaperSource,
  useRunNode,
  useUpdateNode,
} from "../../api/canvases";
import { nextSteps, type NextStep } from "../../lib/nextSteps";
import { Markdown } from "../common/Markdown";

export function NextSteps({
  canvasId,
  detail,
  messages,
  onSend,
}: {
  canvasId: string;
  detail: CanvasDetail;
  messages: ChatMessage[];
  onSend: (text: string) => void;
}) {
  const run = useRunNode(canvasId);
  const update = useUpdateNode(canvasId);
  const fetchSource = useFetchPaperSource(canvasId);
  const steps = nextSteps(detail, messages);

  if (steps.length === 0) {
    return null;
  }

  const take = (step: NextStep) => {
    switch (step.kind) {
      case "command":
        onSend(step.command);
        break;
      case "run":
        run.mutate(step.nodeId);
        break;
      case "fetch":
        fetchSource.mutate(step.nodeId);
        break;
      case "settle":
        update.mutate({
          id: step.nodeId,
          patch: { status: step.status } as UpdateNodeRequest,
        });
        break;
    }
  };

  return (
    <div
      role="group"
      aria-label="Next steps"
      className="flex flex-wrap items-center gap-1.5"
    >
      <span className="text-[11px] text-lm-muted">Next</span>
      {steps.map((step) => (
        <Button
          key={step.label}
          size="sm"
          variant={step.kind === "command" ? "secondary" : "primary"}
          className="h-7 max-w-full px-2.5 text-xs"
          isPending={
            (step.kind === "run" && run.isPending) ||
            (step.kind === "fetch" && fetchSource.isPending) ||
            (step.kind === "settle" && update.isPending)
          }
          onPress={() => take(step)}
        >
          <span className="truncate font-mono">
            <Markdown inline>{step.label}</Markdown>
          </span>
        </Button>
      ))}
    </div>
  );
}
