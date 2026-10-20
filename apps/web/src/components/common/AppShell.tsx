import { Outlet } from "react-router";
import clsx from "clsx";
import { Sidebar } from "./Sidebar";
import { NavBar } from "./NavBar";
import { Onboarding } from "../onboarding/Onboarding";
import { useFullBleed } from "../../lib/hooks";

export function AppShell() {
  const fullBleed = useFullBleed();

  return (
    <div
      className={clsx(
        "flex flex-wrap bg-lm-paper font-sans text-lm-ink",
        fullBleed ? "h-screen overflow-hidden" : "min-h-screen",
      )}
    >
      <Onboarding />
      <Sidebar />
      <main
        className={clsx(
          "flex min-w-0 grow-999 basis-140 flex-col",
          fullBleed && "h-full",
        )}
      >
        <NavBar />
        <div
          className={
            fullBleed
              ? "flex min-h-0 w-full flex-1"
              : "box-border flex w-full flex-col px-4 pt-7 pb-10 sm:px-8"
          }
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
