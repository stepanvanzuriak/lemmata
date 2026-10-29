import { useState, type ReactNode } from "react";
import {
  Button,
  CloseButton,
  Dropdown,
  Form,
  Input,
  Label,
  TextArea,
  TextField,
} from "@heroui/react";
import { Check, ChevronDown, Copy, TrashBin } from "@gravity-ui/icons";
import type { CanvasNode, UpdateNodeRequest } from "shared";
import {
  useCanvas,
  useDeleteNode,
  useRestoreNodes,
  useUpdateNode,
} from "../../api/canvases";
import { CardTags } from "./CardTags";
import { CodeBlock, CodeSection } from "../common/CodeBlock";
import { Markdown } from "../common/Markdown";
import { fieldsOf, isArchived, KIND_LABELS, paperOf } from "./kinds";
import { RunPanel } from "./RunPanel";
import { AgentActions } from "./AgentActions";
import { LiteraturePanel } from "./LiteraturePanel";
import { PaperPanel } from "./PaperPanel";

const STATUSES: Partial<Record<CanvasNode["kind"], string[]>> = {
  goal: ["open", "proved", "disproved"],
  hypothesis: ["open", "supported", "refuted"],
  attack: ["open", "worked", "failed"],
};

const READ_ONLY = new Set<CanvasNode["kind"]>([
  "memory",
  "arxiv",
  "literature",
]);

const isCode = (node: CanvasNode) =>
  node.kind === "python" || node.kind === "lean";
const isToolbox = (node: CanvasNode) => node.kind === "toolbox";

function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      isIconOnly
      size="sm"
      variant="tertiary"
      className="size-6 min-w-0 shrink-0"
      aria-label="Copy card id"
      onPress={() => {
        navigator.clipboard
          .writeText(id)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => undefined);
      }}
    >
      {copied ? (
        <Check width={14} height={14} aria-hidden="true" />
      ) : (
        <Copy width={14} height={14} aria-hidden="true" />
      )}
    </Button>
  );
}

function ReadView({ node, actions }: { node: CanvasNode; actions: ReactNode }) {
  const p = fieldsOf(node);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-start gap-2">
        <h2 className="m-0 min-w-0 flex-1 text-base font-semibold">
          <Markdown inline>{p.title || "Untitled"}</Markdown>
        </h2>
        <CopyIdButton id={node.id} />
      </div>
      {actions}
      {p.text && <Markdown className="text-sm text-lm-ink2">{p.text}</Markdown>}
      {p.markdown && node.kind !== "literature" && (
        <Markdown className="text-sm text-lm-ink2">{p.markdown}</Markdown>
      )}
      <CardTags tags={p.tags} />
      {isCode(node) && (
        <CodeBlock source={p.source || " "} language={node.kind} />
      )}
      {isToolbox(node) && (
        <div className="flex min-w-0 flex-col gap-3">
          {(["python", "lean"] as const).map((language) => (
            <CodeSection
              key={language}
              language={language}
              source={p[language] || "No snippet"}
            />
          ))}
        </div>
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
      className="flex min-w-0 flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const value = (name: string) => String(form.get(name) ?? "");

        const tags = Array.from(
          new Set(
            value("tags")
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          ),
        );
        const patch: UpdateNodeRequest = isCode(node)
          ? { title: value("title"), source: value("source") }
          : isToolbox(node)
            ? {
                title: value("title"),
                text: value("text"),
                python: value("python"),
                lean: value("lean"),
              }
            : {
                title: value("title"),
                text: value("text"),
                markdown: value("markdown"),
              };
        onSave({ ...patch, tags });
      }}
    >
      <TextField name="title" defaultValue={p.title ?? ""}>
        <Label>Title</Label>
        <Input />
      </TextField>
      <TextField name="tags" defaultValue={p.tags?.join(", ") ?? ""}>
        <Label>Topics (comma separated)</Label>
        <Input placeholder="Number theory, Graph theory" />
      </TextField>
      {isCode(node) ? (
        <TextField name="source" defaultValue={p.source ?? ""}>
          <Label>Source</Label>
          <TextArea rows={14} className="font-mono text-xs" />
        </TextField>
      ) : isToolbox(node) ? (
        <>
          <TextField name="text" defaultValue={p.text ?? ""}>
            <Label>Description</Label>
            <TextArea rows={3} />
          </TextField>
          <TextField name="python" defaultValue={p.python ?? ""}>
            <Label>Python snippet</Label>
            <TextArea rows={8} className="font-mono text-xs" />
          </TextField>
          <TextField name="lean" defaultValue={p.lean ?? ""}>
            <Label>Lean snippet</Label>
            <TextArea rows={8} className="font-mono text-xs" />
          </TextField>
        </>
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
  const canvas = useCanvas(canvasId);
  const onCanvas = new Set(
    (canvas.data?.nodes ?? [])
      .filter((n) => n.kind === "arxiv" && !isArchived(n))
      .map((n) => paperOf(n).arxivId ?? ""),
  );
  const p = fieldsOf(node);
  const statuses = STATUSES[node.kind];

  return (
    <aside
      aria-label="Card viewer"
      className="flex w-96 min-w-0 shrink-0 flex-col gap-4 overflow-y-auto border-l border-lm-line bg-lm-aside p-4"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate font-mono text-[11px] tracking-wide text-lm-muted uppercase">
            {KIND_LABELS[node.kind]}
            {p.label && ` · ${p.label}`}
          </span>
          <CloseButton aria-label="Close viewer" onPress={onClose} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {statuses && (
            <Dropdown>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 min-w-0 gap-1.5 px-3 text-sm"
                aria-label="Change card status"
                isDisabled={updateNode.isPending || deleteNode.isPending}
              >
                {(p.status ?? "open")[0]!.toUpperCase() +
                  (p.status ?? "open").slice(1)}
                <ChevronDown width={14} height={14} aria-hidden="true" />
              </Button>
              <Dropdown.Popover placement="bottom start">
                <Dropdown.Menu
                  aria-label="Card status"
                  onAction={(key) => {
                    if (statuses.includes(String(key))) {
                      updateNode.mutate({
                        id: node.id,
                        patch: { status: String(key) } as UpdateNodeRequest,
                      });
                    }
                  }}
                >
                  {statuses.map((status) => (
                    <Dropdown.Item key={status} id={status} textValue={status}>
                      <Label>
                        {status[0]!.toUpperCase() + status.slice(1)}
                      </Label>
                      {p.status === status && (
                        <Check
                          width={14}
                          height={14}
                          aria-label="Current status"
                        />
                      )}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
          {!editing && !READ_ONLY.has(node.kind) && (
            <Button
              size="sm"
              variant="tertiary"
              className="h-8 min-w-0 px-3 text-sm"
              onPress={() => setEditing(true)}
            >
              Edit
            </Button>
          )}
          {node.kind !== "goal" && (
            <Button
              size="sm"
              variant="danger-soft"
              className="h-8 min-w-0 gap-1.5 px-3 text-sm"
              aria-label="Delete card"
              isPending={deleteNode.isPending}
              onPress={() => deleteNode.mutate(node.id, { onSuccess: onClose })}
            >
              <TrashBin width={14} height={14} aria-hidden="true" />
              Delete
            </Button>
          )}
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
        <ReadView
          node={node}
          actions={<AgentActions canvasId={canvasId} node={node} />}
        />
      )}

      {isCode(node) && !editing && <RunPanel canvasId={canvasId} node={node} />}

      {node.kind === "literature" && (
        <LiteraturePanel canvasId={canvasId} node={node} onCanvas={onCanvas} />
      )}

      {node.kind === "arxiv" && <PaperPanel canvasId={canvasId} node={node} />}
    </aside>
  );
}
