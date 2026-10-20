import { useState } from "react";
import { AlertDialog, Button, Chip } from "@heroui/react";
import { Pencil, Pin, PinFill, TrashBin } from "@gravity-ui/icons";
import { formatDistanceToNow, parseISO } from "date-fns";
import type { MemoryEntry, Project } from "shared";
import { useDeleteMemory, useUpdateMemory } from "../../api/memory";
import { Markdown } from "../common/Markdown";
import { ErrorNote } from "../common/State";
import { MemoryDialog } from "./MemoryDialog";
import { MEMORY_KIND_COLORS, MEMORY_KIND_LABELS } from "./kinds";

export function KindChip({ kind }: { kind: MemoryEntry["kind"] }) {
  return (
    <Chip
      size="sm"
      variant="soft"
      color={MEMORY_KIND_COLORS[kind]}
      className="shrink-0"
    >
      {MEMORY_KIND_LABELS[kind]}
    </Chip>
  );
}

function DeleteDialog({
  entry,
  isOpen,
  onOpenChange,
}: {
  entry: MemoryEntry;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const remove = useDeleteMemory();

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog>
          {({ close }) => (
            <>
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>Delete this entry?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="flex flex-col gap-3">
                <p>Later runs will no longer see it.</p>
                {remove.isError && <ErrorNote error={remove.error} />}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" slot="close">
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  isPending={remove.isPending}
                  onPress={() => remove.mutate(entry.id, { onSuccess: close })}
                >
                  Delete entry
                </Button>
              </AlertDialog.Footer>
            </>
          )}
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}

export function MemoryRow({
  entry,
  project,
  projects,
}: {
  entry: MemoryEntry;
  project?: Project;
  projects: Project[];
}) {
  const update = useUpdateMemory();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <li className="flex items-start gap-3 rounded-xl border border-lm-line px-4 py-3">
      <KindChip kind={entry.kind} />
      <div className="min-w-0 flex-1">
        <Markdown>{entry.text}</Markdown>
        <p className="m-0 mt-1 text-xs text-lm-muted">
          {project && <Markdown inline>{project.title}</Markdown>}
          {project && " · "}
          {formatDistanceToNow(parseISO(entry.createdAt), { addSuffix: true })}
        </p>
        {update.isError && <ErrorNote error={update.error} />}
      </div>
      <div className="flex shrink-0 gap-0.5">
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={entry.pinned ? "Unpin entry" : "Pin entry"}
          aria-pressed={entry.pinned}
          isPending={update.isPending}
          onPress={() => update.mutate({ id: entry.id, pinned: !entry.pinned })}
        >
          {entry.pinned ? (
            <PinFill width={16} height={16} aria-hidden="true" />
          ) : (
            <Pin width={16} height={16} aria-hidden="true" />
          )}
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label="Edit entry"
          onPress={() => setEditing(true)}
        >
          <Pencil width={16} height={16} aria-hidden="true" />
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label="Delete entry"
          onPress={() => setDeleting(true)}
        >
          <TrashBin width={16} height={16} aria-hidden="true" />
        </Button>
      </div>

      <MemoryDialog
        entry={entry}
        projects={projects}
        isOpen={editing}
        onOpenChange={setEditing}
      />
      <DeleteDialog
        entry={entry}
        isOpen={deleting}
        onOpenChange={setDeleting}
      />
    </li>
  );
}
