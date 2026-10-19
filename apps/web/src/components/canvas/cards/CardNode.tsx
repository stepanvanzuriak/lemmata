import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import type { CanvasNode } from "shared";
import { CardBody } from "./CardBody";

export type CardData = { node: CanvasNode };
export type CardFlowNode = Node<CardData, "card">;

const handleClass = "!size-2 !border-lm-surface !bg-lm-muted";

export function CardNode({ data, selected }: NodeProps<CardFlowNode>) {
  return (
    <div
      className={clsx(
        "rounded-xl",
        selected &&
          "outline-2 outline-lm-accent [box-shadow:0_0_0_6px_var(--color-lm-accent-soft)]",
      )}
    >
      <Handle type="target" position={Position.Left} className={handleClass} />
      <CardBody node={data.node} />
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  );
}
