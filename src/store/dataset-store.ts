import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Dataset } from "@/lib/csv/parser";
import type { ModelResult } from "@/lib/ml/models";

interface HistoryEntry {
  id: string;
  name: string;
  size: number;
  rows: number;
  columns: number;
  uploadedAt: number;
}

interface DatasetState {
  active: Dataset | null;
  history: HistoryEntry[];
  lastModel: ModelResult | null;
  theme: "light" | "dark";
  setActive: (dataset: Dataset) => void;
  clearActive: () => void;
  replaceRows: (rows: Dataset["rows"], columns?: Dataset["columns"]) => void;
  setModel: (model: ModelResult | null) => void;
  toggleTheme: () => void;
}

const isBrowser = typeof window !== "undefined";

export const useDatasetStore = create<DatasetState>()(
  persist(
    (set, get) => ({
      active: null,
      history: [],
      lastModel: null,
      theme: "light",
      setActive: (dataset) =>
        set((s) => ({
          active: dataset,
          lastModel: null,
          history: [
            {
              id: dataset.id,
              name: dataset.name,
              size: dataset.size,
              rows: dataset.rows.length,
              columns: dataset.columns.length,
              uploadedAt: dataset.uploadedAt,
            },
            ...s.history.filter((h) => h.id !== dataset.id),
          ].slice(0, 12),
        })),
      clearActive: () => set({ active: null, lastModel: null }),
      replaceRows: (rows, columns) => {
        const active = get().active;
        if (!active) return;
        set({
          active: { ...active, rows, columns: columns ?? active.columns },
          lastModel: null,
        });
      },
      setModel: (model) => set({ lastModel: model }),
      toggleTheme: () => {
        const next = get().theme === "light" ? "dark" : "light";
        if (isBrowser) document.documentElement.classList.toggle("dark", next === "dark");
        set({ theme: next });
      },
    }),
    {
      name: "acap:dataset-store",
      storage: createJSONStorage(() => (isBrowser ? window.localStorage : (undefined as never))),
      partialize: (s) => ({ history: s.history, theme: s.theme }),
      onRehydrateStorage: () => (state) => {
        if (isBrowser && state?.theme === "dark") {
          document.documentElement.classList.add("dark");
        }
      },
    },
  ),
);
