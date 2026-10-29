import { Button } from "@heroui/react";
import {
  ArrowRotateLeft,
  BookOpen,
  Check,
  ListCheck,
  NodesRight,
  ShieldCheck,
  Target,
} from "@gravity-ui/icons";
import type {
  CanvasEdge,
  CanvasNode,
  Resolved,
  UpdateNodeRequest,
} from "shared";
import { settleReady } from "shared";
import { useCanvas, useUpdateNode } from "../../api/canvases";
import { useChatStore } from "../../stores/chat";
import { fieldsOf } from "./kinds";

const actionClass = "h-8 min-w-0 gap-1.5 rounded-3xl px-3 text-sm";
const iconProps = { width: 14, height: 14, "aria-hidden": true } as const;

const AGENT_KINDS = new Set<CanvasNode["kind"]>([
  "hypothesis",
  "attack",
  "goal",
  "statement",
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
          className={actionClass}
          variant="ghost"
          isPending={update.isPending}
          onPress={() => setResolved(null)}
        >
          <ArrowRotateLeft {...iconProps} />
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
        <Button
          size="sm"
          className={actionClass}
          variant="primary"
          onPress={fix}
        >
          <Target {...iconProps} />
          Fix with Prover
        </Button>
      )}
      <Button
        size="sm"
        className={actionClass}
        variant="secondary"
        isPending={update.isPending}
        onPress={() =>
          setResolved({ at: new Date().toISOString(), reason: "marked by you" })
        }
      >
        <Check {...iconProps} />
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
  const update = useUpdateNode(canvasId);
  const target = noteTarget(detail?.nodes ?? [], detail?.edges ?? [], node);

  if (fieldsOf(node).archived) {
    return null;
  }

  if (target) {
    return <RefereeNoteActions note={node} target={target} />;
  }

  if (!(AGENT_KINDS.has(node.kind) || LITERATURE_KINDS.has(node.kind))) {
    return null;
  }

  const ref = refOf(node);
  const ProverIcon = node.kind === "goal" ? NodesRight : Target;
  const ready = detail ? settleReady(node, detail) : null;
  if (!send && !ready) {
    return null;
  }
  const settledStatus =
    node.kind === "goal"
      ? ready === "supported"
        ? "proved"
        : "disproved"
      : ready;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Agents"
    >
      {ready && (
        <Button
          size="sm"
          className={actionClass}
          variant="primary"
          isPending={update.isPending}
          onPress={() =>
            update.mutate({
              id: node.id,
              patch: { status: settledStatus } as UpdateNodeRequest,
            })
          }
        >
          <Check {...iconProps} />
          Mark {settledStatus}
        </Button>
      )}
      {ready && (
        <Button
          size="sm"
          className={actionClass}
          variant="ghost"
          isPending={update.isPending}
          onPress={() =>
            update.mutate({
              id: node.id,
              patch: { settleDismissed: true } as UpdateNodeRequest,
            })
          }
        >
          Dismiss
        </Button>
      )}
      {send && AGENT_KINDS.has(node.kind) && (
        <>
          {node.kind !== "statement" && (
            <Button
              size="sm"
              className={actionClass}
              variant="secondary"
              onPress={() => send(`/prover ${ref}`)}
            >
              <ProverIcon {...iconProps} />
              {node.kind === "goal"
                ? "Split"
                : node.kind === "attack"
                  ? "Attack"
                  : "Prove"}
            </Button>
          )}
          {node.kind === "hypothesis" && !ready && (
            <Button
              size="sm"
              className={actionClass}
              variant="secondary"
              onPress={() =>
                send(
                  `/prover ${ref} Propose one attack on this hypothesis as a single attack card linked to it. Do not add more than one, and do not carry it out.`,
                )
              }
            >
              <ListCheck {...iconProps} />
              Plan attack
            </Button>
          )}
          <Button
            size="sm"
            className={actionClass}
            variant="secondary"
            onPress={() => send(`/referee ${ref}`)}
          >
            <ShieldCheck {...iconProps} />
            Referee
          </Button>
        </>
      )}
      {send && LITERATURE_KINDS.has(node.kind) && (
        <Button
          size="sm"
          className={actionClass}
          variant="secondary"
          onPress={() => send(`/literature ${ref}`)}
        >
          <BookOpen {...iconProps} />
          Literature
        </Button>
      )}
    </div>
  );
}
