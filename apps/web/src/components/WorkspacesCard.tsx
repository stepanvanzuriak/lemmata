import { Card, Typography } from "@heroui/react";

export function WorkspacesCard({
  title,
  description,
  subTitle,
}: {
  title: string;
  description: string;
  subTitle: string;
}) {
  return (
    <Card className="gap-1.5 rounded-xl border border-lm-line px-4.5 py-4 shadow-none">
      <Card.Header className="gap-1.5">
        <Typography type="body-sm" color="muted">
          {title}
        </Typography>
        <Card.Description>
          <Typography type="h1" className="font-mono text-[26px] font-medium">
            {description}
          </Typography>
        </Card.Description>
      </Card.Header>
      <Card.Footer>
        <Typography type="body-xs" color="muted">
          {subTitle}
        </Typography>
      </Card.Footer>
    </Card>
  );
}
