import { Card, Typography } from "@heroui/react";
import type { Project } from "shared";
import { ProjectMenu } from "./ProjectMenu";
import { Markdown } from "../common/Markdown";

export function ProjectCard({ project }: { project: Project }) {
  // TODO: Replace with real data
  const linked = true;

  // TODO: Replace with real data
  const liked = ["Additional energy notes", "arXiv 2610.0xxxx"];

  return (
    <Card className="w-full gap-3 rounded-xl border border-lm-line px-5 py-4.5 shadow-none">
      <Card.Header className="flex-row items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
          <Card.Title className="text-base font-semibold">
            <Markdown inline>{project.title}</Markdown>
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
      {linked && (
        <div className="flex gap-2 items-center">
          <Typography type="body-sm" className="text-lm-muted">
            Linked:
          </Typography>
          <div className="flex gap-2 ">
            {liked.map((link) => (
              <Typography
                type="body-xs"
                className="p-0.5 text-lm-paper bg-lm-ink border-transparent rounded-sm"
                key={link}
              >
                {link}
              </Typography>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
