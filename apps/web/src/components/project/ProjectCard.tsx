import { Link, useNavigate } from "react-router";
import { Card, Typography } from "@heroui/react";
import { formatDistanceToNow, parseISO } from "date-fns";
import type { Project } from "shared";
import { paths } from "../../lib/paths";
import { ProjectMenu } from "./ProjectMenu";
import { Markdown } from "../common/Markdown";

export function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  const open = () => navigate(paths.project(project.id));

  return (
    <Card
      className="w-full cursor-pointer gap-3 rounded-xl border border-lm-line px-5 py-4.5 shadow-none hover:border-lm-accent"
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest("button, a, [role=menu]")) {
          open();
        }
      }}
    >
      <Card.Header className="flex-row items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
          <Card.Title className="text-base font-semibold">
            <Link
              to={paths.project(project.id)}
              className="text-inherit no-underline"
            >
              <Markdown inline>{project.title}</Markdown>
            </Link>
          </Card.Title>
          {project.dir && (
            <Typography type="body-xs" className="font-mono text-lm-muted">
              {project.dir}
            </Typography>
          )}
        </div>
        <ProjectMenu project={project} />
      </Card.Header>
      {project.statement && (
        <Card.Content className="text-base leading-[1.45] text-lm-ink2">
          <Markdown>{project.statement}</Markdown>
        </Card.Content>
      )}
      <Card.Footer>
        <Typography type="body-xs" color="muted">
          Updated{" "}
          {formatDistanceToNow(parseISO(project.updatedAt), {
            addSuffix: true,
          })}
        </Typography>
      </Card.Footer>
    </Card>
  );
}
