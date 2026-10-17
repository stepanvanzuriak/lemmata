import { AlertDialog, Button } from "@heroui/react";
import type { Project } from "shared";
import { useDeleteProject } from "../../api/projects";
import { Markdown } from "../common/Markdown";
import { ErrorNote } from "../common/State";

export function DeleteProjectDialog({
  project,
  isOpen,
  onOpenChange,
}: {
  project: Project;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const deleteProject = useDeleteProject();

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog>
          {({ close }) => (
            <>
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>
                  Delete <Markdown inline>{project.title}</Markdown>?
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="flex flex-col gap-3">
                <p>
                  This removes the project and everything Lemmata stored for it.
                  It can't be undone.
                </p>
                {project.dir && (
                  <p>
                    Files in <span className="font-mono">{project.dir}</span>{" "}
                    are kept.
                  </p>
                )}
                {deleteProject.isError && (
                  <ErrorNote error={deleteProject.error} />
                )}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" slot="close">
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  isPending={deleteProject.isPending}
                  onPress={() =>
                    deleteProject.mutate(project.id, { onSuccess: close })
                  }
                >
                  Delete project
                </Button>
              </AlertDialog.Footer>
            </>
          )}
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
