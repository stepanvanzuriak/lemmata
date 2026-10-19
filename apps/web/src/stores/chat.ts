import { create } from "zustand";
import { persist } from "zustand/middleware";

type ChatState = {
  /** Lets the card viewer send `/prover H1` through the open chat panel. */
  send: ((text: string) => void) | null;
  setSend: (send: ((text: string) => void) | null) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  /** Model for Assistant messages; null is the agent's default. */
  assistantModel: string | null;
  setAssistantModel: (model: string | null) => void;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      send: null,
      setSend: (send) => set({ send }),
      collapsed: false,
      setCollapsed: (collapsed) => set({ collapsed }),
      assistantModel: null,
      setAssistantModel: (assistantModel) => set({ assistantModel }),
    }),
    {
      name: "lemmata-chat",
      partialize: ({ collapsed, assistantModel }) => ({
        collapsed,
        assistantModel,
      }),
    },
  ),
);
