import { Button } from "@heroui/react";
import type {
  CanvasEdge,
  CanvasNode,
  Resolved,
  UpdateNodeRequest,
} from "shared";
import { useCanvas, useUpdateNode } from "../../api/canvases";
import { useChatStore } from "../../stores/chat";
import { fieldsOf } from "./kinds";

const AGENT_KINDS = new Set<CanvasNode["kind"]>([
  "hypothesis",
  "attack",
  "goal",
]);
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

function noteTarget(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  note: CanvasNode,
) {
  if (note.kind !== "note") {
    return undefined;
  }

  const edge = edges.find(
    (e) => e.kind === "checked-by" && e.toNode === note.id,
  );

  return nodes.find((n) => n.id === edge?.fromNode);
}

function RefereeNoteActions({
  note,
  target,
}: {
  note: CanvasNode;
  target: CanvasNode;
}) {
  const send = useChatStore((state) => state.send);
  const update = useUpdateNode(note.canvasId);
  const p = fieldsOf(note);
  const resolved = p.resolved;

  const fix = () => {
    const body = p.markdown ?? p.text ?? "";
    send?.(
      `/prover ${refOf(target)} Answer the referee note [${note.id}] "${p.title ?? ""}", then close it with resolve_note.\n\n${body}`,
    );
  };

  const setResolved = (value: Resolved | null) =>
    update.mutate({
      id: note.id,
      patch: { resolved: value } as UpdateNodeRequest,
    });

  if (resolved) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-auto text-[11px] text-lm-muted">
          Resolved{resolved.reason ? `: ${resolved.reason}` : ""}
        </span>
        <Button
          size="sm"
          variant="ghost"
          isPending={update.isPending}
          onPress={() => setResolved(null)}
        >
          Reopen
        </Button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Referee note"
    >
      <span className="text-[11px] text-lm-muted">Gap on {refOf(target)}</span>
      {send && (
        <Button size="sm" variant="primary" onPress={fix}>
          Fix with Prover
        </Button>
      )}
      <Button
        size="sm"
        variant="secondary"
        isPending={update.isPending}
        onPress={() =>
          setResolved({ at: new Date().toISOString(), reason: "marked by you" })
        }
      >
        Resolve
      </Button>
    </div>
  );
}

export function AgentActions({
  canvasId,
  node,
}: {
  canvasId: string;
  node: CanvasNode;
}) {
  const send = useChatStore((state) => state.send);
  const { data: detail } = useCanvas(canvasId);
  const target = noteTarget(detail?.nodes ?? [], detail?.edges ?? [], node);

  if (target) {
    return <RefereeNoteActions note={node} target={target} />;
  }

  if (
    !send ||
    !(AGENT_KINDS.has(node.kind) || LITERATURE_KINDS.has(node.kind))
  ) {
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
      {LITERATURE_KINDS.has(node.kind) && (
        <Button
          size="sm"
          variant="secondary"
          onPress={() => send(`/literature ${ref}`)}
        >
          Check literature
        </Button>
      )}
    </div>
  );
}
