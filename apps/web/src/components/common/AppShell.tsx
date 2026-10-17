import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { NavBar } from "./NavBar";

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-wrap bg-lm-paper font-sans text-lm-ink">
      <Sidebar />
      <main className="flex min-w-0 grow-999 basis-140 flex-col">
        <NavBar />
        <div className="box-border flex w-full flex-col px-4 pt-7 pb-10 sm:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
