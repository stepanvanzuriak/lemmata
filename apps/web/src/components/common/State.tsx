import type { ReactNode } from "react";
import { Button, EmptyState, Spinner, Typography } from "@heroui/react";
import { CircleExclamation } from "@gravity-ui/icons";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-6 text-lm-muted">
      <Spinner size="sm" />
      <Typography type="body-sm" color="muted">
        {label}
      </Typography>
    </div>
  );
}

export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <EmptyState className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-lm-line px-6 py-10 text-center">
      <Typography type="body" className="font-semibold">
        {title}
      </Typography>
      {description && (
        <Typography type="body-sm" color="muted">
          {description}
        </Typography>
      )}
      {action}
    </EmptyState>
  );
}

export function ErrorNote({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: VoidFunction;
}) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-lm-danger/40 bg-lm-danger/5 px-4 py-3"
    >
      <CircleExclamation
        width={18}
        height={18}
        aria-hidden="true"
        className="text-lm-danger"
      />
      <Typography type="body-sm" className="min-w-0 flex-1 text-lm-ink">
        {message}
      </Typography>
      {onRetry && (
        <Button size="sm" variant="tertiary" onPress={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
