import { useRef, useState } from "react";
import {
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  TextField,
  Typography,
} from "@heroui/react";
import { ArrowUpFromLine } from "@gravity-ui/icons";
import { PROJECT_EXPORT_EXTENSION } from "shared";
import { useImportProject } from "../../api/projects";
import { useProjectStore } from "../../stores/project";
import { ErrorNote } from "../common/State";
import { FolderPicker } from "./FolderPicker";

const FORM_ID = "import-project";
const EXTENSION = `.${PROJECT_EXPORT_EXTENSION}`;

const folderNameOf = (file: File) =>
  file.name.endsWith(EXTENSION)
    ? file.name.slice(0, -EXTENSION.length)
    : file.name;

function ImportProjectForm({ close }: { close: VoidFunction }) {
  const importProject = useImportProject();
  const setCurrentProjectId = useProjectStore(
    (state) => state.setCurrentProjectId,
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");

  return (
    <>
      <Modal.Body>
        <Form
          id={FORM_ID}
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            if (!file) {
              return;
            }

            const form = new FormData(event.currentTarget);

            importProject.mutate(
              { file, parent: String(form.get("parent")), name: name.trim() },
              {
                onSuccess: (project) => {
                  setCurrentProjectId(project.id);
                  close();
                },
              },
            );
          }}
        >
          <div className="flex flex-col gap-1">
            <Label>File</Label>
            <input
              ref={fileInput}
              type="file"
              accept={EXTENSION}
              className="hidden"
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null;

                setFile(picked);
                importProject.reset();

                if (picked) {
                  setName(folderNameOf(picked));
                }
              }}
            />
            <div className="flex items-center gap-3">
              <Button
                variant="tertiary"
                className="border border-lm-line"
                onPress={() => fileInput.current?.click()}
              >
                Choose {EXTENSION} file
              </Button>
              <Typography
                type="body-sm"
                className="min-w-0 truncate font-mono text-lm-muted"
              >
                {file?.name ?? "No file chosen"}
              </Typography>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Location</Label>
            <FolderPicker name="parent" />
          </div>

          <TextField
            name="name"
            isRequired
            value={name}
            onChange={setName}
            validate={(value) =>
              /[/\\]/.test(value) ? "Folder name can't contain slashes" : null
            }
          >
            <Label>Folder name</Label>
            <Input className="font-mono" placeholder="my-project" />
            <Description>
              A new folder with this name is created in the location above.
            </Description>
            <FieldError />
          </TextField>

          {importProject.isError && <ErrorNote error={importProject.error} />}
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="tertiary" slot="close">
          Cancel
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          isDisabled={!file || !name.trim()}
          isPending={importProject.isPending}
        >
          Import project
        </Button>
      </Modal.Footer>
    </>
  );
}

export function ImportProjectDialog() {
  return (
    <Modal>
      <Button variant="tertiary" className="border border-lm-line">
        <ArrowUpFromLine width={16} height={16} aria-hidden="true" />
        Import
      </Button>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog>
            {({ close }) => (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>Import project</Modal.Heading>
                </Modal.Header>
                <ImportProjectForm close={close} />
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
