import { create } from "zustand";

export type Lang = "en" | "lt";

interface AppState {
  lang: Lang;
  athlete: string | null;
  setLang: (lang: Lang) => void;
  setAthlete: (athlete: string | null) => void;
}

/** Global UI state (Zustand) — replaces ad-hoc module globals + localStorage reads. */
export const useAppStore = create<AppState>((set) => ({
  lang: "en",
  athlete: null,
  setLang: (lang) => set({ lang }),
  setAthlete: (athlete) => set({ athlete }),
}));
