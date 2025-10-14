export type DealStage = "qualification" | "negotiation" | "proposal" | "closedWon" | "closedLost";

export type DealPeriodFilter = "7d" | "30d" | "90d" | "all";

export interface DealFilters {
  stage?: DealStage | "all";
  managers?: string[];
  period?: DealPeriodFilter;
  search?: string;
}

export interface DealNote {
  id: string;
  dealId: string;
  author: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DealDocument {
  id: string;
  dealId: string;
  title: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  url?: string;
}

export interface Deal {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  value: number;
  probability: number;
  stage: DealStage;
  owner: string;
  updatedAt: string;
  nextReviewAt: string;
  expectedCloseDate?: string;
  tasks: Task[];
  notes: DealNote[];
  documents: DealDocument[];
  payments: Payment[];
  activity: ActivityLogEntry[];
}

export interface DealStageMetrics {
  stage: DealStage;
  count: number;
  totalValue: number;
  conversionRate: number;
  avgCycleDurationDays: number | null;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  industry: string;
  city: string;
  totalDeals: number;
  lifetimeValue: number;
  lastActivityAt: string;
}

export type TaskStatus = "new" | "in_progress" | "waiting" | "done" | "cancelled";

export type TaskActivityType =
  | "call"
  | "meeting"
  | "document"
  | "reminder"
  | "follow_up"
  | "other";

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  status: TaskStatus;
  completed: boolean;
  owner: string;
  type: TaskActivityType;
  tags: string[];
  dealId?: string;
  clientId?: string;
  reminderAt?: string;
}

export type PaymentStatus = "planned" | "expected" | "received" | "paid_out" | "cancelled";

export interface Payment {
  id: string;
  dealId: string;
  clientId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paidAt?: string;
  dueDate: string;
}

export interface ActivityLogEntry {
  id: string;
  type: "note" | "email" | "meeting" | "system";
  author: string;
  message: string;
  createdAt: string;
  clientId: string;
  dealId?: string;
}
