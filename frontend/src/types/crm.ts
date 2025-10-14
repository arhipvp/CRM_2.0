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

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  owner: string;
  dealId?: string;
  clientId?: string;
}

export type PaymentStatus = "planned" | "expected" | "received" | "paid_out" | "cancelled";

export interface PaymentEntry {
  id: string;
  paymentId: string;
  amount: number;
  currency: string;
  category: string;
  postedAt: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface Payment {
  id: string;
  dealId: string;
  dealName?: string;
  clientId: string;
  clientName?: string;
  policyId?: string;
  policyNumber?: string;
  sequence: number;
  amount: number;
  plannedAmount: number;
  currency: string;
  status: PaymentStatus;
  paidAt?: string;
  dueDate?: string;
  plannedDate?: string;
  actualDate?: string;
  comment?: string;
  incomesTotal: number;
  expensesTotal: number;
  netTotal: number;
  incomes: PaymentEntry[];
  expenses: PaymentEntry[];
  createdAt: string;
  updatedAt: string;
  recordedBy?: string;
  updatedBy?: string;
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
