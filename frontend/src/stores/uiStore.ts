import { create } from "zustand";
import { createRandomId } from "@/lib/utils/id";
import { NO_MANAGER_VALUE } from "@/lib/utils/managers";
import type { DealPeriodFilter } from "@/types/crm";
import { createDefaultDealFilters, type DealFiltersState } from "@/lib/utils/dealFilters";

export type PipelineStageKey = "qualification" | "negotiation" | "proposal" | "closedWon" | "closedLost";

export type DealViewMode = "kanban" | "table";

export type DealDetailsTabKey =
  | "overview"
  | "forms"
  | "policies"
  | "journal"
  | "actions"
  | "tasks"
  | "documents"
  | "finance";

type DealDetailsRequestKind = "task" | "note" | "document";

type NotificationType = "info" | "success" | "warning" | "error";

export interface NotificationItem {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: string;
  source?: "crm" | "notifications" | "payments";
}

export interface PaymentEventPayload {
  id?: string;
  type?: string;
  event?: string;
  time?: string;
  data?: Record<string, unknown> | null;
  message?: string;
}

export interface PaymentEventEffect {
  shouldRefetch: boolean;
  highlightDealId?: string;
}

type FiltersState = DealFiltersState;

function normalizeManagers(managers: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const manager of managers) {
    const normalizedManager = manager === NO_MANAGER_VALUE ? NO_MANAGER_VALUE : manager.trim();
    if (!normalizedManager || seen.has(normalizedManager)) {
      continue;
    }

    seen.add(normalizedManager);
    normalized.push(normalizedManager);
  }

  return normalized;
}

interface UiState {
  filters: FiltersState;
  viewMode: DealViewMode;
  selectedDealIds: string[];
  highlightedDealId?: string;
  previewDealId?: string;
  notifications: NotificationItem[];
  dealUpdates: Record<string, string>;
  dismissedHints: Record<string, boolean>;
  dealDetailsTab: DealDetailsTabKey;
  dealDetailsRequests: Partial<Record<DealDetailsRequestKind, string>>;
  setSelectedStage: (stage: PipelineStageKey | "all") => void;
  setManagersFilter: (managers: string[]) => void;
  toggleManagerFilter: (manager: string) => void;
  setPeriodFilter: (period: DealPeriodFilter) => void;
  setSearchFilter: (value: string) => void;
  clearFilters: () => void;
  setViewMode: (mode: DealViewMode) => void;
  toggleDealSelection: (dealId: string) => void;
  selectDeals: (dealIds: string[]) => void;
  clearSelection: () => void;
  openDealPreview: (dealId: string | undefined) => void;
  isHintDismissed: (key: string) => boolean;
  dismissHint: (key: string) => void;
  highlightDeal: (dealId: string | undefined) => void;
  pushNotification: (notification: NotificationItem) => void;
  dismissNotification: (id: string) => void;
  handlePaymentEvent: (event: PaymentEventPayload) => PaymentEventEffect;
  markDealUpdated: (dealId: string) => void;
  clearDealUpdate: (dealId: string) => void;
  setDealDetailsTab: (tab: DealDetailsTabKey) => void;
  triggerDealDetailsRequest: (kind: DealDetailsRequestKind) => void;
  consumeDealDetailsRequest: (kind: DealDetailsRequestKind) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  filters: createDefaultDealFilters(),
  viewMode: "kanban",
  selectedDealIds: [],
  notifications: [],
  dealUpdates: {},
  dismissedHints: {},
  dealDetailsTab: "overview",
  dealDetailsRequests: {},
  setSelectedStage: (stage) =>
    set((state) => ({
      filters: {
        ...state.filters,
        stage,
      },
    })),
  setManagersFilter: (managers) =>
    set((state) => ({
      filters: {
        ...state.filters,
        managers: normalizeManagers(managers),
      },
    })),
  toggleManagerFilter: (manager) =>
    set((state) => {
      const normalizedManager = manager === NO_MANAGER_VALUE ? NO_MANAGER_VALUE : manager.trim();
      if (!normalizedManager) {
        return { filters: { ...state.filters } };
      }

      const hasManager = state.filters.managers.includes(normalizedManager);
      const managers = hasManager
        ? state.filters.managers.filter((item) => item !== normalizedManager)
        : [...state.filters.managers, normalizedManager];

      return {
        filters: {
          ...state.filters,
          managers,
        },
      };
    }),
  setPeriodFilter: (period) =>
    set((state) => ({
      filters: {
        ...state.filters,
        period,
      },
    })),
  setSearchFilter: (value) =>
    set((state) => ({
      filters: {
        ...state.filters,
        search: value,
      },
    })),
  clearFilters: () =>
    set(() => ({
      filters: createDefaultDealFilters(),
      selectedDealIds: [],
    })),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleDealSelection: (dealId) =>
    set((state) => {
      const isSelected = state.selectedDealIds.includes(dealId);
      const selectedDealIds = isSelected
        ? state.selectedDealIds.filter((id) => id !== dealId)
        : [...state.selectedDealIds, dealId];

      return { selectedDealIds };
    }),
  selectDeals: (dealIds) =>
    set((state) => {
      const selected = new Set(state.selectedDealIds);
      for (const id of dealIds) {
        selected.add(id);
      }

      return { selectedDealIds: Array.from(selected) };
    }),
  clearSelection: () => set({ selectedDealIds: [] }),
  openDealPreview: (dealId) => set({ previewDealId: dealId ?? undefined }),
  isHintDismissed: (key) => Boolean(get().dismissedHints[key]),
  dismissHint: (key) =>
    set((state) => ({
      dismissedHints: {
        ...state.dismissedHints,
        [key]: true,
      },
    })),
  highlightDeal: (dealId) => set({ highlightedDealId: dealId ?? undefined }),
  pushNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 20),
    })),
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
    })),
  markDealUpdated: (dealId) =>
    set((state) => ({
      dealUpdates: {
        ...state.dealUpdates,
        [dealId]: new Date().toISOString(),
      },
    })),
  clearDealUpdate: (dealId) =>
    set((state) => {
      const rest = { ...state.dealUpdates };
      delete rest[dealId];
      return { dealUpdates: rest };
    }),
  setDealDetailsTab: (tab) =>
    set({
      dealDetailsTab: tab,
    }),
  triggerDealDetailsRequest: (kind) =>
    set((state) => ({
      dealDetailsTab:
        kind === "task" ? "tasks" : kind === "note" ? "journal" : kind === "document" ? "documents" : state.dealDetailsTab,
      dealDetailsRequests: {
        ...state.dealDetailsRequests,
        [kind]: createRandomId(),
      },
    })),
  consumeDealDetailsRequest: (kind) =>
    set((state) => {
      if (!state.dealDetailsRequests[kind]) {
        return {};
      }

      const nextRequests = { ...state.dealDetailsRequests };
      delete nextRequests[kind];

      return {
        dealDetailsRequests: nextRequests,
      };
    }),
  handlePaymentEvent: (event) => {
    const result = processPaymentEvent(event);

    if (!result) {
      return { shouldRefetch: false };
    }

    if (result.notification) {
      get().pushNotification(result.notification);
    }

    return {
      shouldRefetch: result.shouldRefetch,
      highlightDealId: result.highlightDealId,
    };
  },
}));

interface PaymentEventProcessingResult {
  notification?: NotificationItem;
  highlightDealId?: string;
  shouldRefetch: boolean;
}

function processPaymentEvent(event: PaymentEventPayload): PaymentEventProcessingResult | undefined {
  const type = getEventType(event);

  if (!type) {
    if (event.message) {
      return {
        notification: createPaymentNotification(event.message, "info"),
        shouldRefetch: false,
      };
    }

    return undefined;
  }

  const data = (event.data ?? {}) as Record<string, unknown>;

  switch (type) {
    case "payment.created": {
      const amountText = formatAmount(data);
      const dueDate = formatDate(
        (data.planned_date as string | undefined) ?? (data.due_date as string | undefined),
      );

      const parts = ["Создан новый платёж", amountText && `на ${amountText}`, dueDate && `со сроком ${dueDate}`].filter(Boolean);
      const message = parts.join(" ") || "Создан новый платёж";

      return {
        notification: createPaymentNotification(message, "info"),
        highlightDealId: (data.deal_id as string | undefined) ?? undefined,
        shouldRefetch: true,
      };
    }
    case "payment.status_changed": {
      const status = String(data.status ?? "").toLowerCase();
      const normalizedStatus = status.replace(/[_-]/g, " ").trim();

      let message = "Статус платежа обновлён";
      let level: NotificationType = "info";

      switch (status) {
        case "received":
          message = "Платёж получен";
          level = "success";
          break;
        case "paid_out":
          message = "Платёж выплачен";
          level = "success";
          break;
        case "cancelled":
          message = "Платёж отменён";
          level = "error";
          break;
        case "planned":
          message = "Платёж запланирован";
          break;
        case "expected":
          message = "Ожидается подтверждение платежа";
          break;
        default:
          if (normalizedStatus) {
            message = `${message} (${normalizedStatus})`;
          }
      }

      return {
        notification: createPaymentNotification(message, level),
        highlightDealId: (data.deal_id as string | undefined) ?? undefined,
        shouldRefetch: true,
      };
    }
    case "payment.overdue": {
      const amountText = formatAmount(data);
      const dueDate = formatDate(data.due_date as string | undefined);

      const parts = ["Просрочен платёж", dueDate && `со сроком ${dueDate}`, amountText && amountText].filter(Boolean);
      const message = parts.join(" ") || "Просрочен платёж";

      return {
        notification: createPaymentNotification(message, "warning"),
        highlightDealId: (data.deal_id as string | undefined) ?? undefined,
        shouldRefetch: true,
      };
    }
    default: {
      if (event.message) {
        return {
          notification: createPaymentNotification(event.message, "info"),
          shouldRefetch: false,
        };
      }

      if (Object.keys(data).length > 0) {
        return {
          notification: createPaymentNotification(
            `Обновление платежей: ${JSON.stringify(data)}`,
            "info",
          ),
          shouldRefetch: false,
        };
      }

      return undefined;
    }
  }
}

function getEventType(event: PaymentEventPayload): string | undefined {
  const rawType = event.type ?? event.event ?? undefined;
  if (!rawType) {
    return undefined;
  }

  const withoutPrefix = rawType.startsWith("payments.") ? rawType.replace(/^payments\./, "") : rawType;

  if (!withoutPrefix.includes("payment.")) {
    return undefined;
  }

  if (withoutPrefix === "payment.status.changed") {
    return "payment.status_changed";
  }

  return withoutPrefix;
}

function formatAmount(data: Record<string, unknown>): string | undefined {
  const amount = typeof data.amount === "number" ? data.amount : Number(data.amount);
  if (!Number.isFinite(amount)) {
    return undefined;
  }

  const currency = typeof data.currency === "string" && data.currency ? data.currency : "RUB";

  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`.trim();
  }
}

function formatDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return new Intl.DateTimeFormat("ru-RU").format(date);
}

function createPaymentNotification(message: string, type: NotificationType): NotificationItem {
  return {
    id: createRandomId(),
    message,
    type,
    timestamp: new Date().toISOString(),
    source: "payments",
  };
}
