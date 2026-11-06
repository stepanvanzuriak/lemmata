import { Link } from "react-router";
import { ArrowUpRightFromSquare } from "@gravity-ui/icons";
import { cardStatus, type CanvasLinkPayload } from "shared";
import { useCanvas } from "../../../api/canvases";
import { paths } from "../../../lib/paths";
import { Markdown } from "../../common/Markdown";
import { KIND_LABELS } from "../kinds";
import { Card, Header, StatusChip, type CardProps } from "./Card";

/** The state of a branch's goal, read live from the canvas it points to. */
function useBranchStatus(canvasId: string) {
  const { data } = useCanvas(canvasId);
  const goal = data?.nodes.find(({ kind }) => kind === "goal");

  return goal && data ? cardStatus(goal, data) : null;
}

export function CanvasLinkCard({ node }: CardProps) {
  const { canvasId, title } = node.payload as Partial<CanvasLinkPayload>;
  const status = useBranchStatus(canvasId ?? "");

  return (
    <Card status={status} className="w-80 gap-1.5 border-lm-accent px-4 py-3">
      <Header className="text-lm-accent">{KIND_LABELS.canvas}</Header>
      <div className="text-[13px] leading-[1.45] font-semibold">
        <Markdown inline>{title || "Untitled"}</Markdown>
      </div>
      <StatusChip status={status} />
      {canvasId && (
        <Link
          to={`${paths.canvas}/${canvasId}`}
          className="nodrag nopan flex items-center gap-1 text-xs"
        >
          Open canvas
          <ArrowUpRightFromSquare width={12} height={12} aria-hidden="true" />
        </Link>
      )}
    </Card>
  );
}
