import clsx from "clsx";
import { Spinner } from "@heroui/react";
import { useFigureUrl } from "../../api/figures";

export function Figure({
  nodeId,
  name,
  runAt,
  alt,
  className,
}: {
  nodeId: string;
  name: string;
  runAt: string;
  alt: string;
  className?: string;
}) {
  const url = useFigureUrl(nodeId, name, runAt);

  if (!url) {
    return (
      <div
        className={clsx("flex items-center justify-center bg-white", className)}
      >
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={clsx("bg-white object-contain", className)}
    />
  );
}
