export type NotificationSource = "crm" | "payments" | "system";

export type NotificationCategory = "deal" | "task" | "payment" | "security" | "system";

export type NotificationDeliveryStatus = "delivered" | "failed" | "pending";

export type NotificationSeverity = "info" | "warning" | "error";

export type NotificationChannel = "sse" | "telegram";

export interface NotificationLink {
  href: string;
  label?: string;
}

export interface NotificationContext {
  dealId?: string;
  clientId?: string;
  link?: NotificationLink;
}

export interface NotificationFeedItem {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  source: NotificationSource;
  category: NotificationCategory;
  tags?: string[];
  context?: NotificationContext;
  channels: NotificationChannel[];
  deliveryStatus: NotificationDeliveryStatus;
  read: boolean;
  important: boolean;
}

export interface NotificationFilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface NotificationFeedFilters {
  category?: string;
  source?: NotificationSource | "all";
  status?: "all" | "unread" | "important" | "failed";
  search?: string;
}

export interface NotificationFeedResponse {
  items: NotificationFeedItem[];
  unreadCount: number;
  availableCategories: NotificationFilterOption[];
  availableSources: NotificationFilterOption[];
  channelSettings: NotificationChannelState[];
}

export interface NotificationChannelState {
  channel: NotificationChannel;
  label: string;
  description?: string;
  enabled: boolean;
  editable: boolean;
  lastChangedAt?: string;
}

export interface NotificationEventJournalFilters {
  category?: string;
  source?: NotificationSource | "all";
  severity?: "all" | NotificationSeverity;
  search?: string;
}

export interface NotificationEventEntry {
  id: string;
  timestamp: string;
  actor: string;
  summary: string;
  source: NotificationSource;
  category: NotificationCategory;
  severity: NotificationSeverity;
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface NotificationEventJournalResponse {
  items: NotificationEventEntry[];
  availableCategories: NotificationFilterOption[];
  availableSources: NotificationFilterOption[];
}
