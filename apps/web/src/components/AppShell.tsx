import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-wrap bg-lm-paper font-sans text-lm-ink">
      <Sidebar />
      <main className="flex min-w-0 grow-[999] basis-[560px] flex-col">
        <Outlet />
      </main>
    </div>
  );
}
