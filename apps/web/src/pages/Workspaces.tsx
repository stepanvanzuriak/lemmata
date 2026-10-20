import { useState } from "react";
import { Link } from "react-router";
import { Button, Typography } from "@heroui/react";
import { Magnifier } from "@gravity-ui/icons";
import { WorkspacesCard } from "../components/workspace/WorkspacesCard";
import { ProjectCard } from "../components/project/ProjectCard";
import { useMemory } from "../api/memory";
import { useGetAllProjects } from "../api/projects";
import { paths } from "../lib/paths";
import { KindChip } from "../components/memory/MemoryRow";
import { ProjectSearch } from "../components/project/ProjectSearch";
import { NewProjectDialog } from "../components/project/NewProjectDialog";
import { Markdown } from "../components/common/Markdown";
import { Empty, ErrorNote, Loading } from "../components/common/State";

function ProjectList() {
  const { data, error, isPending, refetch } = useGetAllProjects();

  if (isPending) {
    return <Loading label="Loading projects..." />;
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

const HOME_MEMORY_COUNT = 5;

function MemoryPanel() {
  const { data, error, isPending, refetch } = useMemory();
  const newest = data
    ?.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, HOME_MEMORY_COUNT);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Typography type="h4" className="m-0 text-base font-semibold">
          Research memory
        </Typography>
        <Link to={paths.memory} className="ml-auto text-sm">
          View all
        </Link>
      </div>
      {isPending ? (
        <Loading label="Loading memory..." />
      ) : error ? (
        <ErrorNote error={error} onRetry={() => refetch()} />
      ) : newest && newest.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {newest.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start gap-2 rounded-xl border border-lm-line px-3 py-2"
            >
              <KindChip kind={entry.kind} />
              <Markdown className="min-w-0 text-sm">{entry.text}</Markdown>
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          title="Nothing remembered yet"
          description="Facts and decisions the agent keeps about your project."
        />
      )}
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
          <MemoryPanel />
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
