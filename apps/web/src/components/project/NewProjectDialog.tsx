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
import { Plus } from "@gravity-ui/icons";
import { useCreateProject } from "../../api/projects";
import { useProjectStore } from "../../stores/project";
import { ErrorNote } from "../common/State";
import { FolderPicker } from "./FolderPicker";

const FORM_ID = "new-project";

function NewProjectForm({ close }: { close: VoidFunction }) {
  const createProject = useCreateProject();
  const setCurrentProjectId = useProjectStore(
    (state) => state.setCurrentProjectId,
  );

  return (
    <>
      <Modal.Body>
        <Form
          id={FORM_ID}
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);

            createProject.mutate(
              {
                title: String(form.get("title")),
                statement: String(form.get("statement")),
                dir: String(form.get("dir")),
              },
              {
                onSuccess: (project) => {
                  setCurrentProjectId(project.id);
                  close();
                },
              },
            );
          }}
        >
          <TextField name="title" isRequired autoFocus>
            <Label>Title</Label>
            <Input placeholder="Cauchy-Davenport in $\mathbb{Z}_5$" />
            <FieldError />
          </TextField>

          <TextField name="statement">
            <Label>Statement</Label>
            <TextArea
              rows={5}
              placeholder="What should be proved or refuted? Markdown and math are supported."
            />
            <FieldError />
          </TextField>

          <div className="flex flex-col gap-1">
            <Label>Folder</Label>
            <FolderPicker />
          </div>
          {createProject.isError && <ErrorNote error={createProject.error} />}
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="tertiary" slot="close">
          Cancel
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          isPending={createProject.isPending}
        >
          Create project
        </Button>
      </Modal.Footer>
    </>
  );
}

export function NewProjectDialog() {
  return (
    <Modal>
      <Button variant="tertiary" className="ml-auto border border-lm-line">
        <Plus width={16} height={16} aria-hidden="true" />
        New project
      </Button>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog>
            {({ close }) => (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>New project</Modal.Heading>
                </Modal.Header>
                <NewProjectForm close={close} />
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
