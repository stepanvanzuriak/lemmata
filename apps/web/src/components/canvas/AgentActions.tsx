import { Button } from "@heroui/react";
import type { CanvasNode } from "shared";
import { useChatStore } from "../../stores/chat";
import { fieldsOf } from "./kinds";

const AGENT_KINDS = new Set<CanvasNode["kind"]>(["hypothesis", "goal"]);
const LITERATURE_KINDS = new Set<CanvasNode["kind"]>([
  "hypothesis",
  "goal",
  "statement",
]);

function refOf(node: CanvasNode) {
  if (node.kind === "goal") {
    return "goal";
  }
  return fieldsOf(node).label ?? node.id;
}

export function AgentActions({ node }: { node: CanvasNode }) {
  const send = useChatStore((state) => state.send);

  if (!send || !LITERATURE_KINDS.has(node.kind)) {
    return null;
  }

  const ref = refOf(node);

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Agents"
    >
      <span className="text-[11px] text-lm-muted">Ask</span>
      {AGENT_KINDS.has(node.kind) && (
        <>
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
        </>
      )}
      <Button
        size="sm"
        variant="secondary"
        onPress={() => send(`/literature ${ref}`)}
      >
        Check literature
      </Button>
    </div>
  );
}
