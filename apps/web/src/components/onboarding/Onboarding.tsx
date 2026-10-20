import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Button, Modal, Typography } from "@heroui/react";
import { useSettings, useUpdateSettings } from "../../api/settings";
import { paths } from "../../lib/paths";
import { LemmataMark } from "../icons/LemmataMark";
import { Toolchain } from "./Toolchain";

const Step = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="flex flex-col gap-3">
    <Typography type="h3" className="m-0 text-xl font-semibold">
      {title}
    </Typography>
    {children}
  </div>
);

const Points = ({ items }: { items: [string, string][] }) => (
  <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
    {items.map(([name, text], index) => (
      <li key={name} className="flex gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-lm-accent-soft font-mono text-xs text-lm-accent">
          {index + 1}
        </span>
        <Typography type="body-sm">
          <strong>{name}</strong> {text}
        </Typography>
      </li>
    ))}
  </ol>
);

const steps = [
  {
    id: "welcome",
    body: (
      <Step title="Welcome to Lemmata">
        <Typography type="body-sm" color="muted">
          A research canvas where AI agents work on a problem with you. It runs
          on your machine and keeps everything in a folder you own.
        </Typography>
        <Points
          items={[
            ["Write a goal.", "A project is a statement to prove or refute."],
            [
              "Let the Prover work.",
              "It splits the goal into hypotheses and proves or refutes each.",
            ],
            [
              "Let the Referee check.",
              "It reads the proofs and flags gaps. Python and Lean cards run real checks.",
            ],
            [
              "Read the canvas.",
              "Proofs, counterexamples and checks land as linked cards you can edit.",
            ],
          ]}
        />
      </Step>
    ),
  },
  {
    id: "tools",
    body: (
      <Step title="Check your setup">
        <Typography type="body-sm" color="muted">
          Lemmata uses tools installed on this computer. Only Claude Code is
          required; install the rest whenever you need them. This list updates
          on its own.
        </Typography>
        <Toolchain />
      </Step>
    ),
  },
  {
    id: "start",
    body: (
      <Step title="Start a project">
        <Points
          items={[
            [
              "Create a project",
              "from the Workspace page, with a title and a statement. Math works as $x^2$.",
            ],
            [
              "Open its canvas",
              "and add a Prover or Referee in the chat panel, then pick a model.",
            ],
            [
              "Send a command:",
              "/prover goal to start, or /referee H1 to check a hypothesis.",
            ],
            [
              "Stop and resume any time.",
              "Agents note dead ends in Research memory so later runs do not repeat them.",
            ],
          ]}
        />
        <Typography type="body-xs" color="muted">
          You can replay this tour from Settings.
        </Typography>
      </Step>
    ),
  },
];

/** First-run tour; opens until the workspace is marked as onboarded. */
export function Onboarding() {
  const { data } = useSettings();
  const update = useUpdateSettings();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const step = steps[index]!;
  const last = index === steps.length - 1;

  const finish = () => {
    update.mutate({ onboarded: true });
    setIndex(0);
    navigate(paths.workspace);
  };

  return (
    <Modal.Backdrop
      isOpen={data !== undefined && !data.onboarded}
      isDismissable={false}
      isKeyboardDismissDisabled
    >
      <Modal.Container size="lg">
        <Modal.Dialog aria-label="Welcome tour">
          <Modal.Header>
            <div className="flex items-center gap-2.5">
              <div
                aria-hidden="true"
                className="flex size-7.5 items-center justify-center rounded-[7px] bg-lm-accent text-white"
              >
                <LemmataMark width={24} height={24} />
              </div>
              <Typography type="body-xs" color="muted">
                Step {index + 1} of {steps.length}
              </Typography>
            </div>
          </Modal.Header>
          <Modal.Body>{step.body}</Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onPress={finish}>
              Skip
            </Button>
            <Button
              variant="tertiary"
              isDisabled={index === 0}
              onPress={() => setIndex(index - 1)}
            >
              Back
            </Button>
            <Button
              isPending={update.isPending}
              onPress={last ? finish : () => setIndex(index + 1)}
            >
              {last ? "Get started" : "Next"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
