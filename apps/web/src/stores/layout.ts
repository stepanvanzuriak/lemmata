import { create } from "zustand";
import { persist } from "zustand/middleware";

type LayoutState = {
  /** The main sidebar shows icons only. */
  navCollapsed: boolean;
  setNavCollapsed: (collapsed: boolean) => void;
};

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      navCollapsed: false,
      setNavCollapsed: (navCollapsed) => set({ navCollapsed }),
    }),
    { name: "lemmata-layout" },
  ),
);
