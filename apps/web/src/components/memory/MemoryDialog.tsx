import { useState } from "react";
import {
  Button,
  FieldError,
  Form,
  Label,
  ListBox,
  Modal,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import type { MemoryEntry, MemoryKind, Project } from "shared";
import { useAddMemory, useUpdateMemory } from "../../api/memory";
import { useCurrentProjectId } from "../../lib/hooks";
import { Markdown } from "../common/Markdown";
import { ErrorNote } from "../common/State";
import { MEMORY_KIND_IDS, MEMORY_KIND_LABELS } from "./kinds";

const FORM_ID = "memory-entry";

function MemoryForm({
  entry,
  projects,
  close,
}: {
  entry?: MemoryEntry;
  projects: Project[];
  close: VoidFunction;
}) {
  const add = useAddMemory();
  const update = useUpdateMemory();
  const mutation = entry ? update : add;
  const defaultProjectId = useCurrentProjectId(projects.map(({ id }) => id));
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [kind, setKind] = useState<MemoryKind>(entry?.kind ?? "fact");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("text"));
    const options = { onSuccess: close };

    if (entry) {
      update.mutate({ id: entry.id, kind, text }, options);
    } else {
      add.mutate({ projectId, kind, text }, options);
    }
  };

  return (
    <>
      <Modal.Body>
        <Form id={FORM_ID} className="flex flex-col gap-4" onSubmit={submit}>
          {!entry && (
            <Select
              isRequired
              value={projectId}
              onChange={(key) => key && setProjectId(String(key))}
            >
              <Label>Project</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {projects.map(({ id, title }) => (
                    <ListBox.Item key={id} id={id} textValue={title}>
                      <Markdown inline className="truncate">
                        {title}
                      </Markdown>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}

          <Select
            value={kind}
            onChange={(key) => key && setKind(String(key) as MemoryKind)}
          >
            <Label>Kind</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {MEMORY_KIND_IDS.map((id) => (
                  <ListBox.Item
                    key={id}
                    id={id}
                    textValue={MEMORY_KIND_LABELS[id]}
                  >
                    {MEMORY_KIND_LABELS[id]}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <TextField
            name="text"
            defaultValue={entry?.text}
            isRequired
            autoFocus
          >
            <Label>Note</Label>
            <TextArea
              rows={4}
              placeholder="One sentence a later session should know. Math is supported."
            />
            <FieldError />
          </TextField>

          {mutation.isError && <ErrorNote error={mutation.error} />}
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="tertiary" slot="close">
          Cancel
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          isPending={mutation.isPending}
          isDisabled={!entry && !projectId}
        >
          {entry ? "Save" : "Add entry"}
        </Button>
      </Modal.Footer>
    </>
  );
}

/** Adds an entry by hand, or edits `entry` when given. */
export function MemoryDialog({
  entry,
  projects,
  isOpen,
  onOpenChange,
}: {
  entry?: MemoryEntry;
  projects: Project[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg">
        <Modal.Dialog>
          {({ close }) => (
            <>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>
                  {entry ? "Edit memory entry" : "Add memory entry"}
                </Modal.Heading>
              </Modal.Header>
              <MemoryForm entry={entry} projects={projects} close={close} />
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
