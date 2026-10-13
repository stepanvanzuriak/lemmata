import { createBrowserRouter, type RouteObject } from "react-router";
import { AppShell } from "../components/AppShell";
import { RoutePlaceholder } from "../components/RoutePlaceholder";

export type RouteHandle = { title: string };

const children: RouteObject[] = [
  { index: true, handle: { title: "Workspace" } satisfies RouteHandle },
  {
    path: "canvas",
    handle: { title: "Research canvas" } satisfies RouteHandle,
  },
  { path: "sessions", handle: { title: "Sessions" } satisfies RouteHandle },
  { path: "notebook", handle: { title: "Notebook" } satisfies RouteHandle },
  { path: "literature", handle: { title: "Literature" } satisfies RouteHandle },
  { path: "usage", handle: { title: "Usage & budgets" } satisfies RouteHandle },
].map((r) => ({ ...r, Component: RoutePlaceholder }));

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      ...children,
      {
        path: "*",
        Component: RoutePlaceholder,
        handle: { title: "Not found" } satisfies RouteHandle,
      },
    ],
  },
]);
