import { Button } from "@heroui/react";
import type { CanvasNode } from "shared";
import { useChatStore } from "../../stores/chat";
import { fieldsOf } from "./kinds";

export function AgentActions({ node }: { node: CanvasNode }) {
  const send = useChatStore((state) => state.send);

  if (!send || (node.kind !== "hypothesis" && node.kind !== "goal")) {
    return null;
  }

  const ref = node.kind === "goal" ? "goal" : (fieldsOf(node).label ?? node.id);

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Agents"
    >
      <span className="text-[11px] text-lm-muted">Ask</span>
      <Button
        size="sm"
        variant="secondary"
        onPress={() => send(`/prover ${ref}`)}
      >
        Prover
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onPress={() => send(`/referee ${ref}`)}
      >
        Referee
      </Button>
    </div>
  );
}
