import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { TaskActivityType, TaskStatus } from "@/types/crm";

export type TaskViewMode = "table" | "kanban";

export interface DueDateFilter {
  from?: string;
  to?: string;
}

interface TaskFiltersState {
  statuses: TaskStatus[];
  owners: string[];
  types: TaskActivityType[];
  tags: string[];
  dueDate?: DueDateFilter;
}

interface TasksViewState {
  viewMode: TaskViewMode;
  filters: TaskFiltersState;
  setViewMode: (mode: TaskViewMode) => void;
  setStatuses: (statuses: TaskStatus[]) => void;
  setOwners: (owners: string[]) => void;
  setTypes: (types: TaskActivityType[]) => void;
  setTags: (tags: string[]) => void;
  setDueDate: (range: DueDateFilter | undefined) => void;
  resetFilters: () => void;
}

const defaultFilters: TaskFiltersState = {
  statuses: [],
  owners: [],
  types: [],
  tags: [],
};

export const useTasksViewStore = create(
  persist<TasksViewState>(
    (set) => ({
      viewMode: "table",
      filters: { ...defaultFilters },
      setViewMode: (mode) => set({ viewMode: mode }),
      setStatuses: (statuses) =>
        set((state) => ({
          filters: {
            ...state.filters,
            statuses: [...new Set(statuses)],
          },
        })),
      setOwners: (owners) =>
        set((state) => ({
          filters: {
            ...state.filters,
            owners: owners.map((owner) => owner.trim()).filter(Boolean),
          },
        })),
      setTypes: (types) =>
        set((state) => ({
          filters: {
            ...state.filters,
            types: [...new Set(types)],
          },
        })),
      setTags: (tags) =>
        set((state) => ({
          filters: {
            ...state.filters,
            tags: tags
              .map((tag) => tag.trim())
              .filter(Boolean)
              .map((tag) => tag.toLowerCase()),
          },
        })),
      setDueDate: (range) =>
        set((state) => ({
          filters: {
            ...state.filters,
            dueDate: range,
          },
        })),
      resetFilters: () => set({ filters: { ...defaultFilters } }),
    }),
    {
      name: "crm-tasks-view",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        viewMode: state.viewMode,
      }),
    },
  ),
);

export type { TaskFiltersState };
