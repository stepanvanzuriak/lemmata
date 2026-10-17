import { useState } from "react";
import { Button, Dropdown, Label } from "@heroui/react";
import { EllipsisVertical, TrashBin, Pencil } from "@gravity-ui/icons";
import type { Project } from "shared";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { EditProjectDialog } from "./EditProjectDialog";

export function ProjectMenu({ project }: { project: Project }) {
  const [editProjectOpen, setEditProjectOpen] = useState(false);
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
              if (key === "edit") {
                setEditProjectOpen(true);
              }

              if (key === "delete") {
                setConfirmingDelete(true);
              }
            }}
          >
            <Dropdown.Item id="edit" textValue="Edit">
              <Pencil width={14} height={14} aria-hidden="true" />
              <Label>Edit</Label>
            </Dropdown.Item>
            <Dropdown.Item id="delete" textValue="Delete" variant="danger">
              <TrashBin
                width={14}
                height={14}
                aria-hidden="true"
                className="text-danger"
              />
              <Label>Delete</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <EditProjectDialog
        project={project}
        isOpen={editProjectOpen}
        onOpenChange={setEditProjectOpen}
      />
      <DeleteProjectDialog
        project={project}
        isOpen={confirmingDelete}
        onOpenChange={setConfirmingDelete}
      />
    </>
  );
}
