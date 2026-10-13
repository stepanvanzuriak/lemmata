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
    <Card className="w-100">
      <Card.Header>
        <Typography type="body-sm" color="muted" className="mb-2">
          {title}
        </Typography>
        <Card.Description>
          <Typography type="h1" className="font-mono font-normal">
            {description}
          </Typography>
        </Card.Description>
      </Card.Header>
      <Card.Footer>
        <Typography type="body-sm" color="muted">
          {subTitle}
        </Typography>
      </Card.Footer>
    </Card>
  );
}
