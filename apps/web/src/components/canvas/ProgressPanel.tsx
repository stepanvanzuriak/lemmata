import { Button } from "@heroui/react";
import {
  cardStatus,
  goalReady,
  type CanvasDetail,
  type CanvasNode,
  type Tone,
  type UpdateNodeRequest,
} from "shared";
import { useUpdateNode } from "../../api/canvases";
import { StatusChip } from "./cards/CardBody";
import { fieldsOf } from "./kinds";

function countTones(nodes: CanvasNode[], detail: CanvasDetail) {
  const counts: Record<Tone, number> = {
    ok: 0,
    bad: 0,
    warn: 0,
    work: 0,
    idle: 0,
  };

  for (const node of nodes) {
    const status = cardStatus(node, detail);
    if (status) counts[status.tone] += 1;
  }

  return counts;
}

function Row({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="text-lm-muted">{label}</span>
      <span className="font-mono">{children}</span>
    </div>
  );
}

function labelsOf(nodes: CanvasNode[]) {
  return nodes.map((n) => fieldsOf(n).label ?? fieldsOf(n).title).join(", ");
}

function readyHint(goal: CanvasNode, detail: CanvasDetail, ready: string) {
  const byId = new Map(detail.nodes.map((n) => [n.id, n]));
  const linked = (kind: string) =>
    detail.edges
      .filter((e) => e.fromNode === goal.id && e.kind === kind)
      .map((e) => byId.get(e.toNode))
      .filter((n): n is CanvasNode => n?.kind === "hypothesis");

  if (ready === "disproved") {
    const refuting = linked("refuted-by").filter(
      (n) => fieldsOf(n).status === "supported",
    );
    return `${labelsOf(refuting)} is supported. Does it disprove the goal?`;
  }

  return `${labelsOf(linked("depends-on"))} all supported. Do they prove the goal?`;
}

export function ProgressPanel({
  canvasId,
  detail,
}: {
  canvasId: string;
  detail: CanvasDetail;
}) {
  const updateNode = useUpdateNode(canvasId);
  const goal = detail.nodes.find((n) => n.kind === "goal");
  const of = (...kinds: string[]) =>
    detail.nodes.filter((n) => kinds.includes(n.kind));
  const hypotheses = countTones(of("hypothesis"), detail);
  const checks = countTones(of("python", "lean"), detail);
  const issues = of("note").filter(
    (n) => fieldsOf(n).author === "Referee",
  ).length;
  const ready = goal ? goalReady(goal, detail) : null;

  return (
    <section
      aria-label="Progress"
      className="flex w-76 flex-col gap-2.5 rounded-[10px] border border-lm-line bg-lm-surface p-3 shadow-[0_2px_8px_rgba(20,22,26,0.06)]"
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold tracking-[0.06em] text-lm-muted uppercase">
          Goal
        </span>
        <span className="ml-auto">
          {goal && <StatusChip status={cardStatus(goal, detail)} />}
        </span>
      </div>
      <Row label="Hypotheses">
        {`${hypotheses.ok} ✓ · ${hypotheses.bad} ✗ · ${hypotheses.idle} open`}
      </Row>
      <Row label="Checks">
        {`${checks.ok} passed · ${checks.bad + checks.warn} failed · ${checks.idle} not run`}
      </Row>
      <Row label="Referee issues">{String(issues)}</Row>

      {goal && ready && (
        <div className="flex flex-col gap-2 rounded-lg bg-lm-accent-soft p-2.5 text-xs text-lm-accent-ink">
          {readyHint(goal, detail, ready)}
          <Button
            size="sm"
            isPending={updateNode.isPending}
            onPress={() =>
              updateNode.mutate({
                id: goal.id,
                patch: { status: ready } as UpdateNodeRequest,
              })
            }
          >
            Mark goal {ready}
          </Button>
        </div>
      )}
    </section>
  );
}
