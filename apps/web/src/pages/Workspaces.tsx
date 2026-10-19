import { useState } from "react";
import { Button, Typography } from "@heroui/react";
import { Magnifier } from "@gravity-ui/icons";
import { WorkspacesCard } from "../components/workspace/WorkspacesCard";
import { ProjectCard } from "../components/project/ProjectCard";
import { useGetAllProjects } from "../api/projects";
import { ProjectSearch } from "../components/project/ProjectSearch";
import { NewProjectDialog } from "../components/project/NewProjectDialog";
import { Empty, ErrorNote, Loading } from "../components/common/State";

function ProjectList() {
  const { data, error, isPending, refetch } = useGetAllProjects();

  if (isPending) {
    return <Loading label="Loading projects…" />;
  }

  if (error) {
    return <ErrorNote error={error} onRetry={() => refetch()} />;
  }

  if (data.length === 0) {
    return (
      <Empty
        title="No projects yet"
        description="A project is a problem to work on: a statement to prove or refute."
      />
    );
  }

  return data.map((project) => (
    <ProjectCard key={project.id} project={project} />
  ));
}

function SidePanel({
  title,
  empty,
  description,
}: {
  title: string;
  empty: string;
  description: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <Typography type="h4" className="m-0 text-base font-semibold">
        {title}
      </Typography>
      <Empty title={empty} description={description} />
    </section>
  );
}

export function Workspaces() {
  const [searching, setSearching] = useState(false);

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
          description="—"
          subTitle="Not tracked yet"
        />
        <WorkspacesCard
          title="Running sessions"
          description="—"
          subTitle="Not tracked yet"
        />
        <WorkspacesCard
          title="Hypotheses supported"
          description="—"
          subTitle="Not tracked yet"
        />
        <WorkspacesCard
          title="Goals settled"
          description="—"
          subTitle="Not tracked yet"
        />
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <section className="flex min-w-0 grow-999 basis-130 flex-col gap-3">
          <div className="flex items-center gap-3">
            <Typography type="h4" className="m-0 text-base font-semibold">
              Projects
            </Typography>
            <NewProjectDialog />
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label="Search projects"
              aria-expanded={searching}
              onPress={() => setSearching((open) => !open)}
            >
              <Magnifier width={16} height={16} aria-hidden="true" />
            </Button>
          </div>
          {searching && <ProjectSearch />}
          <ProjectList />
        </section>
        <div className="flex min-w-0 grow basis-85 flex-col gap-6">
          <SidePanel
            title="Recent sessions"
            empty="No sessions yet"
            description="Agent sessions across your canvases will show up here."
          />
          <SidePanel
            title="Research memory"
            empty="Nothing remembered yet"
            description="Facts and decisions the agent keeps about your project."
          />
          <SidePanel
            title="Literature inbox"
            empty="Inbox is empty"
            description="Papers collected for your projects will land here."
          />
        </div>
      </div>
    </div>
  );
}
