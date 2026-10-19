import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import clsx from "clsx";
import { EDGE_LABELS, type CardFlowEdge } from "./edges";

export function KindEdge({
  data,
  style,
  selected,
  ...props
}: EdgeProps<CardFlowEdge>) {
  const [path, labelX, labelY] = getBezierPath(props);
  const kind = data?.kind ?? "depends-on";

  return (
    <>
      <BaseEdge
        path={path}
        style={selected ? { ...style, strokeWidth: 2.4 } : style}
      />
      <EdgeLabelRenderer>
        <div
          className={clsx(
            "pointer-events-none absolute text-[11px] whitespace-nowrap",
            kind === "used-by" ? "text-lm-warn-ink" : "text-lm-muted",
          )}
          style={{
            transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 4}px)`,
          }}
        >
          {EDGE_LABELS[kind]}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
