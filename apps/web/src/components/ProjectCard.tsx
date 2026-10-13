import { Card, Button } from "@heroui/react";

export function ProjectCard({ title }: { title: string }) {
  return (
    <Card className="w-full items-stretch md:flex-row">
      <div className="flex flex-1 flex-col gap-3">
        <Card.Header className="gap-1">
          <Card.Title className="pe-8">{title}</Card.Title>
          <Card.Description>
            Lorem ipsum dolor sit amet consectetur. Sed arcu donec id aliquam
            dolor sed amet faucibus etiam.
          </Card.Description>
        </Card.Header>
        <Card.Footer className="mt-auto flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"></Card.Footer>
      </div>
    </Card>
  );
}
