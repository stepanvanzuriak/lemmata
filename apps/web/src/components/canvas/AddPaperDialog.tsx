import { useState } from "react";
import {
  Button,
  Form,
  Input,
  Label,
  Modal,
  TextField,
  FieldError,
} from "@heroui/react";
import { parseArxivId, type CanvasNode } from "shared";
import { useAddPaper } from "../../api/canvases";
import { ErrorNote } from "../common/State";

const FORM_ID = "add-paper";

function PaperForm({
  canvasId,
  connectFrom,
  onAdded,
  close,
}: {
  canvasId: string;
  connectFrom?: string;
  onAdded: (node: CanvasNode) => void;
  close: VoidFunction;
}) {
  const add = useAddPaper(canvasId);
  const [invalid, setInvalid] = useState(false);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const arxivId = parseArxivId(
      String(new FormData(event.currentTarget).get("paper")),
    );

    setInvalid(!arxivId);
    if (!arxivId) {
      return;
    }
    add.mutate(
      { arxivId, connectFrom },
      {
        onSuccess: (node) => {
          onAdded(node);
          close();
        },
      },
    );
  };

  return (
    <>
      <Modal.Body>
        <Form id={FORM_ID} className="flex flex-col gap-3" onSubmit={submit}>
          <TextField
            name="paper"
            isRequired
            autoFocus
            isInvalid={invalid}
            onChange={() => setInvalid(false)}
          >
            <Label>arXiv id or link</Label>
            <Input placeholder="1107.0327, arxiv.org/abs/1107.0327 or arXiv:1107.0327" />
            <FieldError>
              That is not an arXiv id. Use an id such as 1107.0327 or an
              arxiv.org/abs link.
            </FieldError>
          </TextField>
          {add.isError && <ErrorNote error={add.error} />}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="tertiary" slot="close">
          Cancel
        </Button>
        <Button type="submit" form={FORM_ID} isPending={add.isPending}>
          Add paper
        </Button>
      </Modal.Footer>
    </>
  );
}

export function AddPaperDialog({
  canvasId,
  connectFrom,
  isOpen,
  onOpenChange,
  onAdded,
}: {
  canvasId: string;
  connectFrom?: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAdded: (node: CanvasNode) => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="md">
        <Modal.Dialog>
          {({ close }) => (
            <>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Add paper</Modal.Heading>
              </Modal.Header>
              <PaperForm
                canvasId={canvasId}
                connectFrom={connectFrom}
                onAdded={onAdded}
                close={close}
              />
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
