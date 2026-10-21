import { useState } from "react";
import { Button } from "@heroui/react";
import { ChevronDown, ChevronRight } from "@gravity-ui/icons";
import type { CanvasNode } from "shared";
import { useCanvas } from "../../api/canvases";
import { useChatStore } from "../../stores/chat";
import { Markdown } from "../common/Markdown";
import { fieldsOf, isArchived, KIND_LABELS } from "../canvas/kinds";

const nameOf = (node: CanvasNode) =>
  fieldsOf(node).label ?? fieldsOf(node).title ?? node.id;

export function CardsChanged({
  canvasId,
  ids,
}: {
  canvasId: string;
  ids: string[];
}) {
  const [open, setOpen] = useState(false);
  const { data: detail } = useCanvas(canvasId);
  const focus = useChatStore((state) => state.focus);
  const byId = new Map((detail?.nodes ?? []).map((node) => [node.id, node]));
  const cards = ids.flatMap((id) => {
    const node = byId.get(id);
    return node && !isArchived(node) ? [node] : [];
  });

  if (cards.length === 0) {
    return null;
  }

  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        size="sm"
        variant="ghost"
        className="h-6 self-start px-1.5 text-[11px] text-lm-muted"
        aria-expanded={open}
        onPress={() => setOpen(!open)}
      >
        <Chevron width={12} height={12} aria-hidden="true" />
        {cards.length} {cards.length === 1 ? "card" : "cards"} changed
      </Button>
      {open && (
        <ul
          className="m-0 flex list-none flex-col gap-1 p-0"
          aria-label="Cards changed"
        >
          {cards.map((node) => (
            <li key={node.id} className="flex">
              <Button
                size="sm"
                variant="secondary"
                className="h-auto min-w-0 flex-1 justify-start gap-1.5 px-2 py-1 text-left text-xs"
                isDisabled={!focus}
                onPress={() => focus?.(node.id)}
              >
                <span className="shrink-0 font-mono text-[10px] text-lm-muted uppercase">
                  {KIND_LABELS[node.kind]}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <Markdown inline>{nameOf(node)}</Markdown>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
