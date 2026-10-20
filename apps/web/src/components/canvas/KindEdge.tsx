import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
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
  const [path, labelX, labelY] = getSmoothStepPath({
    ...props,
    borderRadius: 12,
  });
  const kind = data?.kind ?? "depends-on";

  return (
    <>
      <BaseEdge
        path={path}
        style={{
          ...style,
          ...(selected && { strokeWidth: 2.4 }),
          ...(data?.active && { strokeWidth: 2.4 }),
          ...(data?.dim && { opacity: 0.15 }),
        }}
      />
      {(selected || data?.active) && (
        <EdgeLabelRenderer>
          <div
            className={clsx(
              "pointer-events-none absolute rounded bg-lm-surface px-1 text-[11px] whitespace-nowrap",
              kind === "used-by" ? "text-lm-warn-ink" : "text-lm-muted",
            )}
            style={{
              transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 4}px)`,
            }}
          >
            {EDGE_LABELS[kind]}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
