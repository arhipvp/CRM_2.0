import { create } from "zustand";
import type {
  NotificationChannel,
  NotificationChannelState,
  NotificationFeedFilters,
  NotificationFeedItem,
  NotificationFilterOption,
} from "@/types/notifications";

const defaultFilters: NotificationFeedFilters = {
  category: "all",
  source: "all",
  status: "all",
  search: "",
};

type NotificationChannelsStateMap = Partial<Record<NotificationChannel, NotificationChannelState>>;

interface NotificationsDataState {
  items: Record<string, NotificationFeedItem>;
  order: string[];
  unreadCount: number;
  filters: NotificationFeedFilters;
  availableCategories: NotificationFilterOption[];
  availableSources: NotificationFilterOption[];
  selectedIds: string[];
  channels: NotificationChannelsStateMap;
  channelOrder: NotificationChannel[];
  channelPending: Partial<Record<NotificationChannel, boolean>>;
}

interface NotificationsState extends NotificationsDataState {
  setFeed: (items: NotificationFeedItem[], unreadCount: number) => void;
  replaceNotifications: (items: NotificationFeedItem[]) => void;
  restoreNotifications: (items: NotificationFeedItem[]) => void;
  ingestNotification: (item: NotificationFeedItem) => void;
  markAsRead: (ids: string[]) => void;
  markImportant: (ids: string[], important: boolean) => void;
  removeNotifications: (ids: string[]) => void;
  setFilters: (filters: Partial<NotificationFeedFilters>) => void;
  resetFilters: () => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  setAvailableFilters: (payload: { categories: NotificationFilterOption[]; sources: NotificationFilterOption[] }) => void;
  setChannelSettings: (settings: NotificationChannelState[]) => void;
  setChannelEnabled: (channel: NotificationChannel, enabled: boolean) => void;
  setChannelPending: (channel: NotificationChannel, pending: boolean) => void;
  setChannelState: (channel: NotificationChannel, state: NotificationChannelState) => void;
  reset: () => void;
}

function createInitialDataState(): NotificationsDataState {
  return {
    items: {},
    order: [],
    unreadCount: 0,
    filters: { ...defaultFilters },
    availableCategories: [],
    availableSources: [],
    selectedIds: [],
    channels: {},
    channelOrder: [],
    channelPending: {},
  };
}

function sortOrder(order: string[], items: Record<string, NotificationFeedItem>): string[] {
  return [...order]
    .filter((id) => Boolean(items[id]))
    .sort((a, b) => new Date(items[b]!.createdAt).getTime() - new Date(items[a]!.createdAt).getTime());
}

function matchesFilters(item: NotificationFeedItem, filters: NotificationFeedFilters): boolean {
  if (filters.category && filters.category !== "all" && item.category !== filters.category) {
    return false;
  }

  if (filters.source && filters.source !== "all" && item.source !== filters.source) {
    return false;
  }

  if (filters.status && filters.status !== "all") {
    if (filters.status === "unread" && item.read) {
      return false;
    }

    if (filters.status === "important" && !item.important) {
      return false;
    }

    if (filters.status === "failed" && item.deliveryStatus !== "failed") {
      return false;
    }
  }

  const query = filters.search?.trim().toLowerCase();
  if (query) {
    const haystack = [
      item.title,
      item.message,
      ...(item.tags ?? []),
      item.context?.dealId ?? "",
      item.context?.clientId ?? "",
    ]
      .filter(Boolean)
      .join(" \u0000")
      .toLowerCase();

    return haystack.includes(query);
  }

  return true;
}

function mergeChannels(
  prev: NotificationChannelsStateMap,
  settings: NotificationChannelState[],
): NotificationChannelsStateMap {
  const next: NotificationChannelsStateMap = { ...prev };

  for (const channel of settings) {
    next[channel.channel] = { ...channel };
  }

  return next;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  ...createInitialDataState(),
  setFeed: (items, unreadCount) => {
    set((state) => {
      const map: Record<string, NotificationFeedItem> = {};
      for (const item of items) {
        map[item.id] = item;
      }

      const order = sortOrder(
        Object.keys(map),
        map,
      );

      return {
        items: map,
        order,
        unreadCount,
        selectedIds: state.selectedIds.filter((id) => Boolean(map[id])),
      };
    });
  },
  replaceNotifications: (items) => {
    if (items.length === 0) {
      return;
    }

    set((state) => {
      const nextItems = { ...state.items };
      for (const item of items) {
        nextItems[item.id] = item;
      }

      const order = sortOrder(Array.from(new Set([...state.order, ...items.map((item) => item.id)])), nextItems);
      const unreadCount = Object.values(nextItems).filter((item) => !item.read).length;

      return {
        items: nextItems,
        order,
        unreadCount,
      };
    });
  },
  restoreNotifications: (items) => {
    if (items.length === 0) {
      return;
    }

    set((state) => {
      const nextItems = { ...state.items };
      for (const item of items) {
        nextItems[item.id] = item;
      }

      const order = sortOrder(Array.from(new Set([...state.order, ...items.map((item) => item.id)])), nextItems);
      const unreadCount = Object.values(nextItems).filter((item) => !item.read).length;

      return {
        items: nextItems,
        order,
        unreadCount,
      };
    });
  },
  ingestNotification: (item) => {
    set((state) => {
      const existing = state.items[item.id];
      const items = { ...state.items, [item.id]: item };

      let unreadCount = state.unreadCount;
      if (!item.read && (!existing || existing.read)) {
        unreadCount += 1;
      } else if (item.read && existing && !existing.read) {
        unreadCount = Math.max(0, unreadCount - 1);
      }

      let order = state.order;
      if (matchesFilters(item, state.filters)) {
        order = sortOrder([item.id, ...state.order.filter((id) => id !== item.id)], items);
      } else {
        order = state.order.filter((id) => id !== item.id);
      }

      const selectedIds = state.selectedIds.filter((id) => id !== item.id);

      return {
        items,
        order,
        unreadCount,
        selectedIds,
      };
    });
  },
  markAsRead: (ids) => {
    if (ids.length === 0) {
      return;
    }

    set((state) => {
      const items = { ...state.items };
      let unreadCount = state.unreadCount;

      for (const id of ids) {
        const item = items[id];
        if (item && !item.read) {
          items[id] = { ...item, read: true };
          unreadCount = Math.max(0, unreadCount - 1);
        }
      }

      return {
        items,
        unreadCount,
      };
    });
  },
  markImportant: (ids, important) => {
    if (ids.length === 0) {
      return;
    }

    set((state) => {
      const items = { ...state.items };
      for (const id of ids) {
        const item = items[id];
        if (item) {
          items[id] = { ...item, important };
        }
      }

      return { items };
    });
  },
  removeNotifications: (ids) => {
    if (ids.length === 0) {
      return;
    }

    set((state) => {
      const items = { ...state.items };
      let unreadCount = state.unreadCount;

      for (const id of ids) {
        const item = items[id];
        if (item) {
          if (!item.read) {
            unreadCount = Math.max(0, unreadCount - 1);
          }
          delete items[id];
        }
      }

      const order = state.order.filter((id) => !ids.includes(id));
      const selectedIds = state.selectedIds.filter((id) => !ids.includes(id));

      return {
        items,
        order,
        unreadCount,
        selectedIds,
      };
    });
  },
  setFilters: (update) => {
    set((state) => {
      const next: NotificationFeedFilters = { ...state.filters };

      if (update.category !== undefined) {
        next.category = update.category || "all";
      }

      if (update.source !== undefined) {
        next.source = update.source || "all";
      }

      if (update.status !== undefined) {
        next.status = update.status || "all";
      }

      if (update.search !== undefined) {
        next.search = update.search.trim();
      }

      return {
        filters: next,
        selectedIds: [],
      };
    });
  },
  resetFilters: () => {
    set(() => ({ filters: { ...defaultFilters }, selectedIds: [] }));
  },
  toggleSelection: (id) => {
    set((state) => {
      const exists = state.selectedIds.includes(id);
      const selectedIds = exists
        ? state.selectedIds.filter((value) => value !== id)
        : [...state.selectedIds, id];

      return { selectedIds };
    });
  },
  clearSelection: () => set({ selectedIds: [] }),
  setAvailableFilters: ({ categories, sources }) =>
    set({
      availableCategories: categories,
      availableSources: sources,
    }),
  setChannelSettings: (settings) => {
    set(() => {
      const order = settings.map((item) => item.channel);
      const channels = mergeChannels({}, settings);
      return {
        channels,
        channelOrder: order,
        channelPending: {},
      };
    });
  },
  setChannelEnabled: (channel, enabled) => {
    set((state) => {
      const current = state.channels[channel];
      if (!current) {
        return {};
      }

      return {
        channels: {
          ...state.channels,
          [channel]: { ...current, enabled },
        },
      };
    });
  },
  setChannelPending: (channel, pending) =>
    set((state) => ({
      channelPending: {
        ...state.channelPending,
        [channel]: pending,
      },
    })),
  setChannelState: (channel, stateValue) => {
    set((state) => {
      const channels = {
        ...state.channels,
        [channel]: { ...stateValue },
      };

      const order = state.channelOrder.includes(channel)
        ? state.channelOrder
        : [...state.channelOrder, channel];

      return {
        channels,
        channelOrder: order,
        channelPending: {
          ...state.channelPending,
          [channel]: false,
        },
      };
    });
  },
  reset: () => {
    set(() => ({
      ...createInitialDataState(),
    }));
  },
}));

export const selectNotificationItems = (state: NotificationsState) =>
  state.order.map((id) => state.items[id]).filter((item): item is NotificationFeedItem => Boolean(item));

export const selectChannelSettings = (state: NotificationsState) =>
  state.channelOrder.map((channel) => state.channels[channel]).filter(Boolean);
