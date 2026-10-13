import { Typography } from "@heroui/react";

export function RoutePlaceholder() {
  return (
    <div className="flex flex-1 flex-col items-start gap-2 px-8 py-10">
      <Typography.Heading
        level={1}
        className="m-0 text-[28px] tracking-[-0.01em]"
      ></Typography.Heading>
      <Typography type="body-sm" color="muted">
        This screen isn't built yet.
      </Typography>
    </div>
  );
}
