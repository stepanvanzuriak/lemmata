import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  TextArea,
  TextField,
} from "@heroui/react";
import type { Project } from "shared";

const FORM_ID = "edit-project";

function EditProjectForm({
  close,
  project,
}: {
  close: VoidFunction;
  project: Project;
}) {
  return (
    <>
      <Modal.Body>
        <Form
          id={FORM_ID}
          className="flex flex-col gap-4"
          onSubmit={() => {
            close();
          }}
        >
          <TextField name="title" defaultValue={project.title} isRequired>
            <Label>Title</Label>
            <Input placeholder="Cauchy-Davenport in $\mathbb{Z}_5$" />
            <FieldError />
          </TextField>

          <TextField name="statement" defaultValue={project.statement}>
            <Label>Statement</Label>
            <TextArea
              rows={5}
              placeholder="What should be proved or refuted? Markdown and math are supported."
            />
            <FieldError />
          </TextField>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="tertiary" slot="close">
          Cancel
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          // isPending={createProject.isPending}
        >
          Edit project
        </Button>
      </Modal.Footer>
    </>
  );
}

export function EditProjectDialog({
  project,
  isOpen,
  onOpenChange,
}: {
  project: Project;
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
                <Modal.Heading>Edit project</Modal.Heading>
              </Modal.Header>

              <EditProjectForm project={project} close={close} />
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
