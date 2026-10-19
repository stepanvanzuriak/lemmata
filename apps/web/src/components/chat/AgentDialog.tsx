import { useState } from "react";
import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import type { CanvasAgent } from "shared";
import { useAddAgent, useUpdateAgent } from "../../api/chat";
import { ModelSelect } from "./ModelSelect";

type AgentRole = CanvasAgent["role"];

const roleName = (role: string) => role[0]!.toUpperCase() + role.slice(1);

function AgentForm({
  canvasId,
  role,
  agent,
  close,
}: {
  canvasId: string;
  role: AgentRole;
  agent?: CanvasAgent;
  close: VoidFunction;
}) {
  const addAgent = useAddAgent(canvasId);
  const updateAgent = useUpdateAgent(canvasId);
  const [model, setModel] = useState<string | null>(agent?.model ?? null);
  const [tokenCap, setTokenCap] = useState(
    agent?.tokenCap ? String(agent.tokenCap) : "",
  );
  const pending = addAgent.isPending || updateAgent.isPending;
  const error = addAgent.error ?? updateAgent.error;

  const save = () => {
    const cap = Number(tokenCap);
    const input = {
      model,
      tokenCap: tokenCap && cap > 0 ? Math.round(cap) : null,
    };
    const options = { onSuccess: close };

    if (agent) {
      updateAgent.mutate({ id: agent.id, ...input }, options);
    } else {
      addAgent.mutate({ role, ...input }, options);
    }
  };

  return (
    <>
      <Modal.Body className="flex flex-col gap-4">
        <ModelSelect label="Model" value={model} onChange={setModel} />
        <TextField value={tokenCap} onChange={setTokenCap}>
          <Label>Token cap per run</Label>
          <Input type="number" min={1} placeholder="Default: 1,000,000" />
        </TextField>
        {error && (
          <p role="alert" className="m-0 text-xs text-lm-danger">
            {error.message}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="tertiary" slot="close">
          Cancel
        </Button>
        <Button isPending={pending} onPress={save}>
          {agent ? "Save" : `Add ${roleName(role)}`}
        </Button>
      </Modal.Footer>
    </>
  );
}

/** Add an agent, or change an existing agent's model and token cap. */
export function AgentDialog({
  canvasId,
  role,
  agent,
  isOpen,
  onOpenChange,
}: {
  canvasId: string;
  role: AgentRole;
  agent?: CanvasAgent;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="sm">
        <Modal.Dialog>
          {({ close }) => (
            <>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>
                  {agent ? roleName(role) : `Add ${roleName(role)}`}
                </Modal.Heading>
              </Modal.Header>
              <AgentForm
                canvasId={canvasId}
                role={role}
                agent={agent}
                close={close}
              />
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
