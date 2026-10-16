import { useState } from "react";
import { Button, Dropdown, Label } from "@heroui/react";
import { EllipsisVertical, TrashBin } from "@gravity-ui/icons";
import type { Project } from "shared";
import { DeleteProjectDialog } from "./DeleteProjectDialog";

export function ProjectMenu({ project }: { project: Project }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <>
      <Dropdown>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label="Project actions"
        >
          <EllipsisVertical width={16} height={16} aria-hidden="true" />
        </Button>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu
            onAction={(key) => {
              if (key === "delete") {
                setConfirmingDelete(true);
              }
            }}
          >
            <Dropdown.Item id="delete" textValue="Delete" variant="danger">
              <TrashBin
                width={14}
                height={14}
                aria-hidden="true"
                className="text-danger"
              />
              <Label>Delete…</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <DeleteProjectDialog
        project={project}
        isOpen={confirmingDelete}
        onOpenChange={setConfirmingDelete}
      />
    </>
  );
}
