import type { MouseEvent, ReactNode } from "react";
import { Button } from "@heroui/react";
import type { CanvasNode, UpdateNodeRequest } from "shared";
import { useRunNode, useUpdateNode } from "../../../api/canvases";
import { useChatStore } from "../../../stores/chat";
import { fieldsOf, literatureOf } from "../kinds";

export type Ready = "supported" | "refuted" | null;

const GOAL_STATUS = { supported: "proved", refuted: "disproved" } as const;

/** How chat commands name a card. */
function refOf(node: CanvasNode) {
  if (node.kind === "goal") {
    return "goal";
  }
  return fieldsOf(node).label ?? node.id;
}

// Read at click time: subscribing to `send` re-renders on every chat render.
const send = (text: string) => useChatStore.getState().send?.(text);

// Clicks here must not select the card (which opens the viewer) or start a drag.
const keep = (event: MouseEvent) => event.stopPropagation();

function Action({
  children,
  onPress,
  isPending,
  primary,
}: {
  children: ReactNode;
  onPress: VoidFunction;
  isPending?: boolean;
  primary?: boolean;
}) {
  return (
    <Button
      size="sm"
      variant={primary ? "primary" : "secondary"}
      className="h-7 min-w-0 px-2.5 text-xs shadow-sm"
      isPending={isPending}
      onPress={onPress}
    >
      {children}
    </Button>
  );
}

function SettleAction({ node, ready }: { node: CanvasNode; ready: Ready }) {
  const update = useUpdateNode(node.canvasId);

  if (!ready) {
    return null;
  }

  const status = node.kind === "goal" ? GOAL_STATUS[ready] : ready;

  return (
    <Action
      primary
      isPending={update.isPending}
      onPress={() =>
        update.mutate({
          id: node.id,
          patch: { status } as UpdateNodeRequest,
        })
      }
    >
      Mark {status}
    </Action>
  );
}

function RunAction({ node }: { node: CanvasNode }) {
  const run = useRunNode(node.canvasId);

  return (
    <Action
      primary
      isPending={run.isPending}
      onPress={() => run.mutate(node.id)}
    >
      {fieldsOf(node).run ? "Re-run" : "Run"}
    </Action>
  );
}

function actionsFor(node: CanvasNode, ready: Ready): ReactNode {
  const ref = refOf(node);

  switch (node.kind) {
    case "goal":
      return (
        <>
          <SettleAction node={node} ready={ready} />
          <Action onPress={() => send(`/prover goal`)}>Split</Action>
          <Action onPress={() => send(`/literature goal`)}>Literature</Action>
        </>
      );
    case "hypothesis":
      return (
        <>
          <SettleAction node={node} ready={ready} />
          <Action onPress={() => send(`/prover ${ref}`)}>Prove</Action>
          <Action
            onPress={() =>
              send(
                `/prover ${ref} Propose up to three distinct attacks on this hypothesis as attack cards linked to it. Do not carry them out.`,
              )
            }
          >
            Plan attacks
          </Action>
          <Action onPress={() => send(`/referee ${ref}`)}>Referee</Action>
          <Action onPress={() => send(`/literature ${ref}`)}>Literature</Action>
        </>
      );
    case "attack":
      return (
        <>
          <Action primary onPress={() => send(`/prover ${ref}`)}>
            Attack
          </Action>
          <Action onPress={() => send(`/referee ${ref}`)}>Referee</Action>
        </>
      );
    case "statement":
      return (
        <>
          <Action onPress={() => send(`/referee ${ref}`)}>Referee</Action>
          <Action onPress={() => send(`/literature ${ref}`)}>Literature</Action>
        </>
      );
    case "python":
    case "lean":
      return <RunAction node={node} />;
    case "literature":
      return (
        <Action onPress={() => send(`/literature ${node.id}`)}>
          {literatureOf(node).checkedAt ? "Re-check" : "Check"}
        </Action>
      );
    default:
      return null;
  }
}

/**
 * The card's own actions, under it on the canvas: shown on hover and while selected, so the
 * common moves (prove, referee, run, check literature, settle) need no viewer.
 */
export function CardActions({
  node,
  ready,
  visible,
}: {
  node: CanvasNode;
  /** What the card's links already decide (see `settleReady`). */
  ready: Ready;
  visible: boolean;
}) {
  const actions = actionsFor(node, ready);

  if (!actions || fieldsOf(node).archived) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="Card actions"
      onClick={keep}
      onDoubleClick={keep}
      className={`nodrag nopan absolute top-full left-0 z-10 mt-1.5 flex gap-1 transition-opacity group-hover:opacity-100 focus-within:opacity-100 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      {actions}
    </div>
  );
}
