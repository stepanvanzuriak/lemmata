import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";
import { Typography } from "@heroui/react";
import { ErrorNote } from "./State";

export function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error;

  return (
    <div className="flex flex-col gap-4">
      <Typography type="h1" className="m-0 text-[28px] font-semibold">
        Something went wrong
      </Typography>
      <ErrorNote error={message} onRetry={() => navigate(0)} />
    </div>
  );
}
