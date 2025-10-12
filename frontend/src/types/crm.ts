export type DealStage = "qualification" | "negotiation" | "proposal" | "closedWon" | "closedLost";

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
  expectedCloseDate?: string;
  tasks: Task[];
  notes: DealNote[];
  documents: DealDocument[];
  payments: Payment[];
  activity: ActivityLogEntry[];
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
