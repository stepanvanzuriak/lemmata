import { create } from "zustand";
import { persist } from "zustand/middleware";

type ProjectState = {
  currentProjectId: string | null;
  setCurrentProjectId: (id: string) => void;
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      currentProjectId: null,
      setCurrentProjectId: (id) => set({ currentProjectId: id }),
    }),
    {
      name: "lemmata-current-project",
      partialize: ({ currentProjectId }) => ({ currentProjectId }),
    },
  ),
);

window.addEventListener("storage", (event) => {
  if (event.key === useProjectStore.persist.getOptions().name) {
    useProjectStore.persist.rehydrate();
  }
});
