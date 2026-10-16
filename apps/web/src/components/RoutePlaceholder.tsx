import { Typography } from "@heroui/react";
import { useRouteTitle } from "../lib/hooks";

export function RoutePlaceholder() {
  const title = useRouteTitle();

  return (
    <div className="flex flex-col items-start gap-2">
      <Typography type="h1" className="m-0 text-[28px] font-semibold">
        {title}
      </Typography>
      <Typography type="body-sm" color="muted">
        This screen isn't built yet.
      </Typography>
    </div>
  );
}
