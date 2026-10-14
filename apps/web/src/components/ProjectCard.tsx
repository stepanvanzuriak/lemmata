import { Card, Typography } from "@heroui/react";
import { Katex } from "./Katex";

const DEFAULT_DESCRIPTION =
  "Lorem ipsum dolor sit amet consectetur. Sed arcu donec id aliquam dolor sed amet faucibus etiam.";

export function ProjectCard({
  title,
  path,
  description = DEFAULT_DESCRIPTION,
}: {
  title: string;
  path: string;
  description?: string;
}) {
  return (
    <Card className="w-full gap-3 rounded-xl border border-lm-line px-5 py-4.5 shadow-none">
      <Card.Header className="gap-1.5">
        <div className="flex justify-between">
          <div className="flex items-center gap-2">
            <Card.Title className="text-base font-semibold">
              <Katex>{title}</Katex>
            </Card.Title>
            <Typography type="body-xs" className="font-mono">
              {path}
            </Typography>
          </div>
          <Typography type="body-sm" color="muted">
            Session 2h ago
          </Typography>
        </div>

        <Card.Description className="text-base leading-[1.45] text-lm-ink2">
          <Katex>{description}</Katex>
        </Card.Description>
      </Card.Header>
    </Card>
  );
}
