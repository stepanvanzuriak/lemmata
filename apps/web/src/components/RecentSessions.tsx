import { Card } from "@heroui/react";

export function RecentSessions() {
  return (
    <Card
      className="gap-1 rounded-xl border border-lm-line px-4.5 py-4 shadow-none"
      variant="default"
    >
      <Card.Header className="mb-1.5">
        <Card.Title className="text-[15px] font-semibold">
          Recent sessions
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <p>The default card variant for most use cases</p>
      </Card.Content>
    </Card>
  );
}
