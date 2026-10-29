import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import { ChevronDown, ChevronRight, Layers } from "@gravity-ui/icons";
import type { CanvasNode, CardStatus } from "shared";
import { CardTags } from "../CardTags";
import { CardBody } from "./CardBody";

export type CardData = {
  node: CanvasNode;
  status: CardStatus | null;
  descendantCount?: number;
  collapsed?: boolean;
  onToggleChildren?: () => void;
};
export type CardFlowNode = Node<CardData, "card">;

const handleClass = "!size-2 !border-lm-surface !bg-lm-muted";

export function CardNode({ data, selected }: NodeProps<CardFlowNode>) {
  const ToggleIcon = data.collapsed ? ChevronRight : ChevronDown;
  const toggleLabel = data.collapsed ? "Expand children" : "Collapse children";

  return (
    <div
      className={clsx(
        "group relative isolate rounded-xl",
        selected &&
          "outline-2 outline-lm-accent [box-shadow:0_0_0_6px_var(--color-lm-accent-soft)]",
      )}
    >
      {data.collapsed && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-2 top-3 -bottom-2 -z-20 rounded-xl border border-lm-accent/25 bg-lm-surface"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-1 top-2 -bottom-1 -z-10 rounded-xl border border-lm-accent/40 bg-lm-surface"
          />
        </>
      )}
      <Handle type="target" position={Position.Left} className={handleClass} />
      <CardBody node={data.node} status={data.status} />
      <CardTags tags={data.node.payload.tags} className="max-w-72 px-2 pt-1" />
      {!!data.descendantCount && (
        <div
          className={clsx(
            "mt-1 flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs",
            data.collapsed
              ? "border border-lm-accent/30 bg-lm-accent-soft text-lm-accent"
              : "text-lm-muted",
          )}
        >
          <span className="flex items-center gap-1.5">
            {data.collapsed && (
              <Layers width={14} height={14} aria-hidden="true" />
            )}
            {data.collapsed
              ? `Collapsed · ${data.descendantCount} hidden`
              : `${data.descendantCount} children`}
          </span>
          <button
            type="button"
            className="nodrag nopan flex size-6 shrink-0 items-center justify-center rounded-md border border-current/20 bg-lm-surface hover:bg-lm-accent-soft hover:text-lm-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-accent"
            aria-label={toggleLabel}
            aria-expanded={!data.collapsed}
            title={`${toggleLabel} (or double-click the card)`}
            onClick={(event) => {
              event.stopPropagation();
              data.onToggleChildren?.();
            }}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <ToggleIcon width={14} height={14} aria-hidden="true" />
          </button>
        </div>
      )}
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  );
}
