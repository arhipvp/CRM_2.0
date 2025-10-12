import { create } from "zustand";

export type PipelineStageKey = "qualification" | "negotiation" | "proposal" | "closedWon" | "closedLost";

type NotificationType = "info" | "success" | "warning" | "error";

export interface NotificationItem {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: string;
  source?: "crm" | "notifications";
}

interface UiState {
  selectedStage: PipelineStageKey | "all";
  highlightedDealId?: string;
  notifications: NotificationItem[];
  setSelectedStage: (stage: PipelineStageKey | "all") => void;
  highlightDeal: (dealId: string | undefined) => void;
  pushNotification: (notification: NotificationItem) => void;
  dismissNotification: (id: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedStage: "all",
  notifications: [],
  setSelectedStage: (stage) => set({ selectedStage: stage }),
  highlightDeal: (dealId) => set({ highlightedDealId: dealId ?? undefined }),
  pushNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 20),
    })),
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
    })),
}));
