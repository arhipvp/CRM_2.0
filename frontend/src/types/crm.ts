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

export interface DealRiskTag {
  id: string;
  label: string;
  tone: "low" | "medium" | "high" | "critical";
  description?: string;
}

export interface DealPriorityTag {
  label: string;
  level: "low" | "normal" | "high" | "urgent";
  reason?: string;
}

export interface DealQuickTag {
  id: string;
  label: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
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
  avatarUrl?: string;
  riskTags?: DealRiskTag[];
  priorityTag?: DealPriorityTag;
  quickTags?: DealQuickTag[];
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

export interface DealOverviewMetric {
  id: string;
  label: string;
  value: string;
  hint?: string;
  accent?: "default" | "warning" | "danger" | "success";
}

export interface DealNextEvent {
  id: string;
  label: string;
  date: string;
  isOverdue?: boolean;
  isSoon?: boolean;
}

export interface DealWarningBadge {
  id: string;
  label: string;
  severity: "info" | "warning" | "critical";
  description?: string;
}

export interface DealActivitySummary {
  id: string;
  title: string;
  occurredAt: string;
  author: string;
  channel: "call" | "email" | "meeting" | "note" | "task" | "system";
  excerpt?: string;
  attachments?: number;
}

export interface DealConfirmedPayment {
  id: string;
  amount: number;
  currency: string;
  paidAtActual: string;
  recordedBy: {
    id: string;
    name: string;
    title?: string;
  };
  comment?: string;
}

export interface DealOverviewData {
  metrics: DealOverviewMetric[];
  nextEvents: DealNextEvent[];
  warnings: DealWarningBadge[];
  lastInteractions: DealActivitySummary[];
  confirmedPayments: DealConfirmedPayment[];
  currentPolicyId?: string;
}

export interface DealFormFieldOption {
  value: string;
  label: string;
}

export interface DealFormField {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea" | "currency";
  value: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  options?: DealFormFieldOption[];
}

export interface DealFormGroup {
  id: string;
  title: string;
  collapsedByDefault?: boolean;
  fields: DealFormField[];
}

export interface DealCalculationFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  url?: string;
}

export type DealCalculationStatus = "draft" | "pending" | "ready" | "confirmed" | "archived";

export interface DealCalculation {
  id: string;
  insurer: string;
  program: string;
  premium: number;
  currency: string;
  period: string;
  status: DealCalculationStatus;
  policyId?: string;
  updatedAt: string;
  files: DealCalculationFile[];
  tags: DealQuickTag[];
}

export type DealPolicyStatus = "draft" | "active" | "expiring" | "expired" | "cancelled" | "archived";

export interface DealPolicyPaymentPosition {
  id: string;
  kind: "income" | "expense";
  title: string;
  plannedAmount: number;
  actualAmount?: number;
  status: "draft" | "pending" | "approved" | "rejected";
  documentLinks?: string[];
}

export interface DealPolicyPaymentTimelineEvent {
  id: string;
  label: string;
  at: string;
  user: string;
  comment?: string;
}

export interface DealPolicyPayment {
  id: string;
  number: string;
  plannedDate: string;
  actualDate?: string;
  amount: number;
  currency: string;
  confirmationStatus: "draft" | "expected" | "confirmed" | "rejected";
  responsible?: string;
  tags: DealQuickTag[];
  incomes: DealPolicyPaymentPosition[];
  expenses: DealPolicyPaymentPosition[];
  timeline: DealPolicyPaymentTimelineEvent[];
}

export interface DealPolicy {
  id: string;
  number: string;
  product: string;
  status: DealPolicyStatus;
  periodStart: string;
  periodEnd: string;
  premium: number;
  currency: string;
  owner: string;
  highlight?: boolean;
  badges: DealQuickTag[];
  payments: DealPolicyPayment[];
}

export interface DealDocumentVersionInfo {
  id: string;
  version: number;
  uploadedAt: string;
  uploadedBy: string;
  size: number;
  comment?: string;
}

export type DealDocumentReviewStatus = "pending" | "approved" | "rejected";

export interface DealDocumentV2 {
  id: string;
  name: string;
  type: string;
  size: number;
  category: string;
  uploadedAt: string;
  uploadedBy: string;
  reviewStatus: DealDocumentReviewStatus;
  reviewComment?: string;
  reviewer?: string;
  versions: DealDocumentVersionInfo[];
  url?: string;
}

export interface DealDocumentCategory {
  id: string;
  title: string;
  documents: DealDocumentV2[];
}

export interface DealActionShortcut {
  id: string;
  label: string;
  description?: string;
  intent: "task" | "email" | "documents" | "custom";
  disabledReason?: string;
}

export interface DealActionIntegration {
  id: string;
  label: string;
  description?: string;
  status: "ready" | "error" | "disabled";
  actionLabel?: string;
  errorMessage?: string;
}

export interface DealActionBanner {
  id: string;
  message: string;
  type: "info" | "warning" | "error";
}

export interface DealActionsPanel {
  shortcuts: DealActionShortcut[];
  integrations: DealActionIntegration[];
  banners: DealActionBanner[];
}

export type DealTaskCardStage = "todo" | "in_progress" | "done";
export type DealTaskCardType = "call" | "meeting" | "document" | "custom";

export interface DealTaskChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface DealTaskCard {
  id: string;
  title: string;
  dueDate?: string;
  owner: string;
  stage: DealTaskCardStage;
  type: DealTaskCardType;
  checklist: DealTaskChecklistItem[];
  journalLinkId?: string;
}

export interface DealTaskLane {
  id: "assigned" | "waiting" | "archive";
  title: string;
  tasks: DealTaskCard[];
  emptyCta?: string;
  hint?: string;
}

export interface DealTaskFilterOption {
  id: string;
  label: string;
  active: boolean;
}

export interface DealTasksBoardFilters {
  types: DealTaskFilterOption[];
  showForeign: boolean;
}

export interface DealTasksBoard {
  filters: DealTasksBoardFilters;
  lanes: DealTaskLane[];
}

export interface DealFinanceMetric {
  id: string;
  label: string;
  amount: number;
  currency: string;
  delta?: number;
  linkToPayments?: boolean;
}

export interface DealFinanceSummary {
  lastUpdated: string;
  metrics: DealFinanceMetric[];
  exportAvailable: boolean;
  exportDisabledReason?: string;
}

export interface DealDetailsData {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  stage: DealStage;
  value: number;
  probability: number;
  expectedCloseDate?: string;
  nextReviewAt: string;
  updatedAt: string;
  owner: string;
  avatarUrl?: string;
  riskTags: DealRiskTag[];
  priorityTag?: DealPriorityTag;
  quickTags: DealQuickTag[];
  overview: DealOverviewData;
  forms: DealFormGroup[];
  policies: DealPolicy[];
  calculations: DealCalculation[];
  actions: DealActionsPanel;
  tasksBoard: DealTasksBoard;
  documentsV2: DealDocumentCategory[];
  finance: DealFinanceSummary;
  activity: ActivityLogEntry[];
}
