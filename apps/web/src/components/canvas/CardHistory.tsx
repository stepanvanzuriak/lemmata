import { useState } from "react";
import { Button } from "@heroui/react";
import { ChevronDown } from "@gravity-ui/icons";
import clsx from "clsx";
import type { CanvasAgent, CardExchange } from "shared";
import { useAgents, useCardExchanges } from "../../api/chat";
import { Markdown } from "../common/Markdown";

function speaker(exchange: CardExchange, agents: CanvasAgent[]) {
  const message = exchange.request ?? exchange.reply!;
  const role = agents.find((a) => a.id === message.agentId)?.role;
  return role ? role[0]!.toUpperCase() + role.slice(1) : "Assistant";
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

/** The chat runs that targeted or changed this card. */
export function CardHistory({
  canvasId,
  nodeId,
}: {
  canvasId: string;
  nodeId: string;
}) {
  const [open, setOpen] = useState(false);
  const exchanges = useCardExchanges(canvasId, nodeId);
  const agents = useAgents(canvasId);
  const list = exchanges.data ?? [];

  if (list.length === 0) {
    return null;
  }

  return (
    <section aria-label="Agent history" className="flex flex-col gap-2">
      <Button
        size="sm"
        variant="tertiary"
        className="h-7 min-w-0 justify-start gap-1.5 px-0 text-[11px] font-semibold tracking-[0.06em] text-lm-muted uppercase"
        aria-expanded={open}
        onPress={() => setOpen(!open)}
      >
        <ChevronDown
          width={12}
          height={12}
          aria-hidden="true"
          className={clsx("transition-transform", !open && "-rotate-90")}
        />
        Agent history ({list.length})
      </Button>
      {open && (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {[...list].reverse().map((exchange) => {
            const first = exchange.request ?? exchange.reply!;
            const archived =
              exchange.request?.archivedBy || exchange.reply?.archivedBy;
            return (
              <li
                key={first.id}
                className="flex flex-col gap-1.5 rounded-lg border border-lm-line bg-lm-surface px-3 py-2"
              >
                <span className="text-[11px] text-lm-muted">
                  {speaker(exchange, agents.data ?? [])} ·{" "}
                  {when(first.createdAt)}
                  {first.target !== nodeId && " · changed it"}
                  {archived && " · before reset"}
                </span>
                {exchange.request && (
                  <span className="text-sm whitespace-pre-wrap text-lm-ink2">
                    {exchange.request.text}
                  </span>
                )}
                {exchange.reply ? (
                  <Markdown className="text-sm">{exchange.reply.text}</Markdown>
                ) : (
                  <span className="text-xs text-lm-muted italic">
                    No reply recorded.
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
