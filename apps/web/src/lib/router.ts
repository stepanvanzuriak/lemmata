import { createBrowserRouter } from "react-router";
import { AppShell } from "../components/AppShell";
import { RouteError } from "../components/RouteError";
import { RoutePlaceholder } from "../components/RoutePlaceholder";
import { Settings } from "../pages/Settings";
import { Workspaces } from "../pages/Workspaces";

export type RouteHandle = { title: string };

const placeholder = (path: string, title: string) => ({
  path,
  Component: RoutePlaceholder,
  handle: { title } satisfies RouteHandle,
});

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      {
        ErrorBoundary: RouteError,
        children: [
          {
            index: true,
            Component: Workspaces,
            handle: { title: "Workspace" } satisfies RouteHandle,
          },
          placeholder("canvas", "Research canvas"),
          placeholder("sessions", "Sessions"),
          placeholder("notebook", "Notebook"),
          placeholder("literature", "Literature"),
          placeholder("usage", "Usage & budgets"),
          {
            path: "settings",
            Component: Settings,
            handle: { title: "Settings" } satisfies RouteHandle,
          },
          placeholder("*", "Not found"),
        ],
      },
    ],
  },
]);
