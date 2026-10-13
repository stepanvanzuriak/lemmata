import { Button, Typography } from "@heroui/react";
import { WorkspacesCard } from "../components/WorkspacesCard";
import { ProjectCard } from "../components/ProjectCard";
import { RecentSessions } from "../components/RecentSessions";

export function Workspaces() {
  return (
    <div className="flex flex-col gap-5">
      <Typography type="h1">Workspace</Typography>
      <div className="flex gap-2">
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
      <div className="flex gap-4">
        <div className="flex gap-2 flex-col grow">
          <div className="flex justify-between">
            <Typography type="h4">Projects</Typography>

            <Button variant="secondary">New Project</Button>
          </div>
          <ProjectCard title="Sumsets in finite fields" />

          <ProjectCard title="Sumsets in finite fields" />
        </div>
        <div>
          <RecentSessions />
        </div>
      </div>
    </div>
  );
}
