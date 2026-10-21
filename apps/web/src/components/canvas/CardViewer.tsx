import { useState } from "react";
import {
  Button,
  CloseButton,
  Form,
  Input,
  Label,
  TextArea,
  TextField,
} from "@heroui/react";
import type { CanvasNode, UpdateNodeRequest } from "shared";
import {
  useDeleteNode,
  useRestoreNodes,
  useUpdateNode,
} from "../../api/canvases";
import { Markdown } from "../common/Markdown";
import { fieldsOf, KIND_LABELS } from "./kinds";
import { RunPanel } from "./RunPanel";
import { AgentActions } from "./AgentActions";
import { LiteraturePanel } from "./LiteraturePanel";

const STATUSES: Partial<Record<CanvasNode["kind"], string[]>> = {
  goal: ["open", "proved", "disproved"],
  hypothesis: ["open", "supported", "refuted"],
};

const READ_ONLY = new Set<CanvasNode["kind"]>([
  "memory",
  "arxiv",
  "literature",
]);

const isCode = (node: CanvasNode) =>
  node.kind === "python" || node.kind === "lean";

function ReadView({ node }: { node: CanvasNode }) {
  const p = fieldsOf(node);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="m-0 text-base font-semibold">
        <Markdown inline>{p.title || "Untitled"}</Markdown>
      </h2>
      {p.text && <Markdown className="text-sm text-lm-ink2">{p.text}</Markdown>}
      {p.markdown && node.kind !== "literature" && (
        <Markdown className="text-sm text-lm-ink2">{p.markdown}</Markdown>
      )}
      {isCode(node) && (
        <pre className="m-0 overflow-auto rounded-lg bg-lm-code p-3 font-mono text-xs leading-normal text-lm-nav-fg">
          {p.source || " "}
        </pre>
      )}
    </div>
  );
}

function EditForm({
  node,
  onSave,
  onCancel,
  isPending,
}: {
  node: CanvasNode;
  onSave: (patch: UpdateNodeRequest) => void;
  onCancel: VoidFunction;
  isPending: boolean;
}) {
  const p = fieldsOf(node);

  return (
    <Form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const value = (name: string) => String(form.get(name) ?? "");

        onSave(
          isCode(node)
            ? { title: value("title"), source: value("source") }
            : {
                title: value("title"),
                text: value("text"),
                markdown: value("markdown"),
              },
        );
      }}
    >
      <TextField name="title" defaultValue={p.title ?? ""}>
        <Label>Title</Label>
        <Input />
      </TextField>
      {isCode(node) ? (
        <TextField name="source" defaultValue={p.source ?? ""}>
          <Label>Source</Label>
          <TextArea rows={14} className="font-mono text-xs" />
        </TextField>
      ) : (
        <>
          <TextField name="text" defaultValue={p.text ?? ""}>
            <Label>Text</Label>
            <TextArea rows={4} />
          </TextField>
          <TextField name="markdown" defaultValue={p.markdown ?? ""}>
            <Label>Markdown</Label>
            <TextArea rows={8} />
          </TextField>
        </>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="tertiary" onPress={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isPending={isPending}>
          Save
        </Button>
      </div>
    </Form>
  );
}

export function CardViewer({
  canvasId,
  node,
  onClose,
}: {
  canvasId: string;
  node: CanvasNode;
  onClose: VoidFunction;
}) {
  const [editing, setEditing] = useState(false);
  const updateNode = useUpdateNode(canvasId);
  const deleteNode = useDeleteNode(canvasId);
  const restore = useRestoreNodes(canvasId);
  const p = fieldsOf(node);
  const statuses = STATUSES[node.kind];

  return (
    <aside
      aria-label="Card viewer"
      className="flex w-96 shrink-0 flex-col gap-4 overflow-y-auto border-l border-lm-line bg-lm-aside p-4"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] tracking-wide text-lm-muted uppercase">
          {KIND_LABELS[node.kind]}
          {p.label && ` · ${p.label}`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {!editing && !READ_ONLY.has(node.kind) && (
            <Button
              size="sm"
              variant="tertiary"
              onPress={() => setEditing(true)}
            >
              Edit
            </Button>
          )}
          <CloseButton aria-label="Close viewer" onPress={onClose} />
        </div>
      </div>

      {p.archived && (
        <div className="flex items-center gap-2 rounded-lg border border-lm-line bg-lm-chip px-3 py-2 text-xs text-lm-muted">
          <span className="min-w-0 flex-1">
            Archived{p.archived.reason ? `: ${p.archived.reason}` : ""}. Hidden
            from the canvas.
          </span>
          <Button
            size="sm"
            variant="secondary"
            isPending={restore.isPending}
            onPress={() => restore.mutate({ ids: [node.id] })}
          >
            Restore
          </Button>
        </div>
      )}

      {editing ? (
        <EditForm
          node={node}
          isPending={updateNode.isPending}
          onCancel={() => setEditing(false)}
          onSave={(patch) =>
            updateNode.mutate(
              { id: node.id, patch },
              { onSuccess: () => setEditing(false) },
            )
          }
        />
      ) : (
        <ReadView node={node} />
      )}

      {statuses && (
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Status"
        >
          {statuses.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={p.status === status ? "primary" : "secondary"}
              onPress={() =>
                updateNode.mutate({
                  id: node.id,
                  patch: { status } as UpdateNodeRequest,
                })
              }
            >
              {status[0]!.toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      )}

      {isCode(node) && !editing && <RunPanel canvasId={canvasId} node={node} />}

      {node.kind === "literature" && (
        <LiteraturePanel canvasId={canvasId} node={node} />
      )}

      {!editing && <AgentActions canvasId={canvasId} node={node} />}

      {node.kind !== "goal" && (
        <Button
          size="sm"
          variant="danger-soft"
          className="mt-auto self-start"
          isPending={deleteNode.isPending}
          onPress={() => deleteNode.mutate(node.id, { onSuccess: onClose })}
        >
          Delete card
        </Button>
      )}
    </aside>
  );
}
