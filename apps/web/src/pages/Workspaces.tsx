import { Button, Typography } from "@heroui/react";
import { WorkspacesCard } from "../components/WorkspacesCard";
import { ProjectCard } from "../components/ProjectCard";
import { RecentSessions } from "../components/RecentSessions";

export function Workspaces() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Typography type="h1" className="m-0 text-[28px] font-semibold">
          Workspace
        </Typography>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <WorkspacesCard
          title="Tokens today"
          description="1.84M"
          subTitle="71% cache reads · 6 sessions"
        />
        <WorkspacesCard
          title="Spend · October"
          description="$46.20"
          subTitle="38% of $120 monthly budget"
        />
        <WorkspacesCard
          title="Running sessions"
          description="2"
          subTitle="1 waiting on your approval"
        />
        <WorkspacesCard
          title="Lemmas checked in Lean"
          description="23 / 41"
          subTitle="3 still contain sorry"
        />
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <section className="flex min-w-0 grow-999 basis-130 flex-col gap-3">
          <div className="flex items-center gap-3">
            <Typography type="h4" className="m-0 text-base font-semibold">
              Projects
            </Typography>
            <Button
              variant="tertiary"
              className="ml-auto border border-lm-line"
            >
              New Project
            </Button>
          </div>
          <ProjectCard
            path="~/research/sumsets"
            title="Sumsets in finite fields"
            description="Bounds on $|A + A|$ for $A \subseteq \mathbb{F}_p$ with small doubling; Freiman-type structure for $|A| < p/(2K)$."
          />
          <ProjectCard path="~/research/energy" title="Addition energy notes" />
        </section>
        <div className="flex min-w-0 grow basis-85 flex-col gap-6">
          <RecentSessions />
        </div>
      </div>
    </div>
  );
}
