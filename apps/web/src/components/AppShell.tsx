import { Outlet, useMatches } from "react-router";
import type { RouteHandle } from "../lib/router";
import { Sidebar } from "./Sidebar";
import { NavBar } from "./NavBar";

export function AppShell() {
  const title = useMatches()
    .map((m) => (m.handle as RouteHandle | undefined)?.title)
    .findLast(Boolean);

  return (
    <div className="flex min-h-screen flex-wrap bg-lm-paper font-sans text-lm-ink">
      <Sidebar />
      <main className="flex min-w-0 grow-999 basis-140 flex-col">
        <NavBar title={title ?? ""} />
        <div className="box-border flex w-full flex-col px-4 pt-7 pb-10 sm:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
