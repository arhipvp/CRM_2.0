import {
  activitiesMock,
  clientsMock,
  dealDetailsMock,
  dealDocumentsMock,
  dealNotesMock,
  dealsMock,
  paymentsMock,
  tasksMock,
} from "@/mocks/data";
import type {
  ActivityLogEntry,
  Client,
  Deal,
  DealDetailsData,
  DealDocument,
  DealFilters,
  DealPeriodFilter,
  DealNote,
  DealStage,
  DealStageMetrics,
  Payment,
  PaymentEntry,
  PaymentStatus,
  Task,
  TaskStatus,
} from "@/types/crm";
import { compareDealsByNextReview, sortDealsByNextReview } from "@/lib/utils/deals";
import { createRandomId } from "@/lib/utils/id";
import { NO_MANAGER_VALUE } from "@/lib/utils/managers";

export interface ApiClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

function parseTimeout(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

const ENV_TIMEOUT_MS = parseTimeout(process.env.FRONTEND_PROXY_TIMEOUT);

function normalizeTimeout(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return value;
}

function mergeAbortSignals(signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
  const activeSignals = signals.filter(Boolean) as AbortSignal[];

  if (activeSignals.length === 0) {
    return undefined;
  }

  if (activeSignals.length === 1) {
    return activeSignals[0];
  }

  const controller = new AbortController();
  const abort = (signal: AbortSignal) => {
    if (!controller.signal.aborted) {
      // `reason` доступен не во всех окружениях, поэтому подстрахуемся.
      const reason = (signal as AbortSignal & { reason?: unknown }).reason;
      controller.abort(reason);
    }
  };

  for (const signal of activeSignals) {
    if (signal.aborted) {
      abort(signal);
      break;
    }

    signal.addEventListener("abort", () => abort(signal), { once: true });
  }

  return controller.signal;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export interface DealTaskPayload {
  title: string;
  dueDate?: string;
  owner?: string;
}

export interface DealNotePayload {
  content: string;
}

export interface DealDocumentPayload {
  title: string;
  fileName: string;
  fileSize: number;
  url?: string;
}

export interface PaymentPayload {
  dealId: string;
  clientId: string;
  policyNumber: string;
  policyId?: string;
  plannedDate: string;
  plannedAmount: number;
  currency: string;
  status?: PaymentStatus;
  comment?: string;
  actualDate?: string | null;
  recordedBy?: string;
}

export interface PaymentUpdatePayload {
  plannedDate?: string;
  plannedAmount?: number;
  currency?: string;
  status?: PaymentStatus;
  comment?: string | null;
  actualDate?: string | null;
  recordedBy?: string | null;
}

export interface PaymentEntryPayload {
  amount: number;
  category: string;
  postedAt: string;
  note?: string;
}
export type UpdateTaskPayload = Partial<
  Pick<Task, "status" | "owner" | "dueDate" | "tags" | "type" | "reminderAt" | "completed">
>;

export interface UpdateDealPayload {
  name?: string;
  stage?: Deal["stage"];
  value?: number;
  probability?: number;
  expectedCloseDate?: string | null;
  owner?: string;
  nextReviewAt: string;
}

export class ApiClient {
  constructor(private readonly config: ApiClientConfig = {}) {}

  private get baseUrl() {
    return this.config.baseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  private get timeoutMs(): number {
    return normalizeTimeout(this.config.timeoutMs) ?? ENV_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS;
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
    fallback?: () => T | Promise<T>,
  ): Promise<T> {
    const baseUrl = this.baseUrl?.trim();
    const useMocks = !baseUrl || baseUrl === "mock";

    const resolveWithFallback = async (
      error?: unknown,
      missingFallbackMessage?: string,
    ): Promise<T> => {
      if (fallback) {
        return await fallback();
      }

      if (error instanceof ApiError) {
        throw error;
      }

      if (missingFallbackMessage) {
        throw new ApiError(missingFallbackMessage);
      }

      if (error instanceof Error) {
        throw new ApiError(error.message);
      }

      throw new ApiError("Request failed");
    };

    if (useMocks) {
      return await resolveWithFallback(
        undefined,
        "API base URL is not configured or mock mode is enabled without a fallback",
      );
    }

    let url: string;
    try {
      url = new URL(path, baseUrl).toString();
    } catch (error) {
      return await resolveWithFallback(
        error,
        "Failed to construct API URL and no fallback is available",
      );
    }

    const timeoutMs = this.timeoutMs;
    const timeoutController = typeof AbortController !== "undefined" ? new AbortController() : undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (timeoutController) {
      timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    }

    try {
      const response = await fetch(url, {
        ...init,
        signal: mergeAbortSignals([timeoutController?.signal, init?.signal ?? undefined]),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...this.config.headers,
          ...init?.headers,
        },
      });

      if (!response.ok) {
        const details = await response.text();
        throw new ApiError(details || response.statusText, response.status);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (timeoutController && timeoutController.signal.aborted) {
        const timeoutError = new ApiError(`Request timed out after ${timeoutMs} ms`);
        return await resolveWithFallback(timeoutError, "Request timed out and no fallback is available");
      }

      if (error instanceof ApiError) {
        throw error;
      }

      return await resolveWithFallback(error, "Request failed and no fallback is available");
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private buildQueryString(filters?: DealFilters): string {
    if (!filters) {
      return "";
    }

    const params = new URLSearchParams();

    if (filters.stage && filters.stage !== "all") {
      params.set("stage", filters.stage);
    }

    if (filters.managers && filters.managers.length > 0) {
      for (const manager of filters.managers) {
        params.append("manager", manager === NO_MANAGER_VALUE ? NO_MANAGER_VALUE : manager);
      }
    }

    if (filters.period && filters.period !== "all") {
      params.set("period", filters.period);
    }

    if (filters.search) {
      params.set("search", filters.search);
    }

    const query = params.toString();
    return query ? `?${query}` : "";
  }

  async getDeals(filters?: DealFilters): Promise<Deal[]> {
    const query = this.buildQueryString(filters);
    const deals = await this.request(`/crm/deals${query}`, undefined, async () => filterDealsMock(dealsMock, filters));
    return sortDealsByNextReview(deals);
  }

  getDealStageMetrics(filters?: DealFilters): Promise<DealStageMetrics[]> {
    const query = this.buildQueryString(filters);
    return this.request(
      `/crm/deals/stage-metrics${query}`,
      undefined,
      async () => calculateStageMetrics(filterDealsMock(dealsMock, filters)),
    );
  }

  getDealDetails(id: string): Promise<DealDetailsData> {
    return this.request(`/crm/deals/${id}`, undefined, async () => {
      const deal = dealDetailsMock[id];
      if (!deal) {
        throw new ApiError("Deal not found", 404);
      }

      const tasks = tasksMock.filter((item) => item.dealId === id);
      const notes = dealNotesMock.filter((item) => item.dealId === id);
      const documents = dealDocumentsMock.filter((item) => item.dealId === id);
      const payments = paymentsMock
        .filter((item) => item.dealId === id)
        .map((payment) => clonePayment(payment));
      const activity = activitiesMock.filter((item) => item.dealId === id);

      return {
        ...deal,
        tasks,
        notes,
        documents,
        payments,
        activity,
      };
      const base = dealsMock.find((item) => item.id === id);
      if (base) {
        deal.value = base.value;
        deal.probability = base.probability;
        deal.stage = base.stage;
        deal.owner = base.owner;
        deal.nextReviewAt = base.nextReviewAt;
        deal.expectedCloseDate = base.expectedCloseDate;
        deal.updatedAt = base.updatedAt;
      }

      return JSON.parse(JSON.stringify(deal)) as DealDetailsData;
    });
  }

  getDealTasks(dealId: string): Promise<Task[]> {
    return this.request(`/crm/deals/${dealId}/tasks`, undefined, async () =>
      tasksMock.filter((task) => task.dealId === dealId),
    );
  }

  createDealTask(dealId: string, payload: DealTaskPayload): Promise<Task> {
    return this.request(
      `/crm/deals/${dealId}/tasks`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const deal = dealsMock.find((item) => item.id === dealId);
        const task: Task = {
          id: createRandomId(),
          title: payload.title,
          dueDate: payload.dueDate ?? new Date().toISOString(),
          completed: false,
          owner: payload.owner ?? deal?.owner ?? "",
          dealId,
          clientId: deal?.clientId,
        };
        tasksMock.unshift(task);
        return task;
      },
    );
  }

  getDealNotes(dealId: string): Promise<DealNote[]> {
    return this.request(`/crm/deals/${dealId}/notes`, undefined, async () =>
      dealNotesMock.filter((note) => note.dealId === dealId),
    );
  }

  createDealNote(dealId: string, payload: DealNotePayload): Promise<DealNote> {
    return this.request(
      `/crm/deals/${dealId}/notes`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const note: DealNote = {
          id: createRandomId(),
          dealId,
          author: "Вы",
          content: payload.content,
          createdAt: new Date().toISOString(),
        };
        dealNotesMock.unshift(note);
        return note;
      },
    );
  }

  getDealDocuments(dealId: string): Promise<DealDocument[]> {
    return this.request(`/crm/deals/${dealId}/documents`, undefined, async () =>
      dealDocumentsMock.filter((doc) => doc.dealId === dealId),
    );
  }

  uploadDealDocument(dealId: string, payload: DealDocumentPayload): Promise<DealDocument> {
    return this.request(
      `/crm/deals/${dealId}/documents`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const document: DealDocument = {
          id: createRandomId(),
          dealId,
          title: payload.title,
          fileName: payload.fileName,
          fileSize: payload.fileSize,
          uploadedAt: new Date().toISOString(),
          uploadedBy: "Вы",
          url: payload.url,
        };
        dealDocumentsMock.unshift(document);
        return document;
      },
    );
  }

  getDealPayments(dealId: string): Promise<Payment[]> {
    return this.request(`/crm/deals/${dealId}/payments`, undefined, async () =>
      paymentsMock
        .filter((payment) => payment.dealId === dealId)
        .map((payment) => clonePayment(payment)),
    );
  }

  getDealActivity(dealId: string): Promise<ActivityLogEntry[]> {
    return this.request(`/crm/deals/${dealId}/activity`, undefined, async () =>
      activitiesMock.filter((entry) => entry.dealId === dealId),
    );
  }

  updateDeal(dealId: string, payload: UpdateDealPayload): Promise<Deal> {
    return this.request(
      `/crm/deals/${dealId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      async () => {
        const deal = dealsMock.find((item) => item.id === dealId);
        if (!deal) {
          throw new ApiError("Deal not found", 404);
        }

        if (payload.name !== undefined) {
          deal.name = payload.name;
        }
        if (payload.stage !== undefined) {
          deal.stage = payload.stage;
        }
        if (payload.value !== undefined) {
          deal.value = payload.value;
        }
        if (payload.probability !== undefined) {
          deal.probability = payload.probability;
        }
        if (payload.owner !== undefined) {
          deal.owner = payload.owner;
        }

        deal.nextReviewAt = payload.nextReviewAt;

        if (payload.expectedCloseDate !== undefined) {
          deal.expectedCloseDate = payload.expectedCloseDate ?? undefined;
        }

        deal.updatedAt = new Date().toISOString();

        const details = dealDetailsMock[dealId];
        if (details) {
          details.name = deal.name;
          details.stage = deal.stage;
          details.value = deal.value;
          details.probability = deal.probability;
          details.owner = deal.owner;
          details.nextReviewAt = deal.nextReviewAt;
          details.expectedCloseDate = deal.expectedCloseDate;
          details.updatedAt = deal.updatedAt;

          const nextReviewField = details.forms
            .flatMap((group) => group.fields)
            .find((field) => field.id === "nextReviewAt");
          if (nextReviewField) {
            nextReviewField.value = deal.nextReviewAt.slice(0, 10);
          }
        }

        return this.getDealDetails(dealId);
      },
    );
  }

  updateDealStage(dealId: string, stage: DealStage): Promise<Deal> {
    return this.request(
      `/crm/deals/${dealId}/stage`,
      {
        method: "PATCH",
        body: JSON.stringify({ stage }),
      },
      async () => updateDealStageMock(dealId, stage),
    );
  }

  getClients(): Promise<Client[]> {
    return this.request("/crm/clients", undefined, async () => clientsMock);
  }

  getClient(id: string): Promise<Client> {
    return this.request(`/crm/clients/${id}`, undefined, async () => {
      const client = clientsMock.find((item) => item.id === id);
      if (!client) {
        throw new ApiError("Client not found", 404);
      }
      return client;
    });
  }

  getTasks(): Promise<Task[]> {
    return this.request("/crm/tasks", undefined, async () => tasksMock);
  }

  async updateTask(taskId: string, payload: UpdateTaskPayload): Promise<Task> {
    const changes = sanitizeTaskPatch(payload);

    return this.request(
      `/crm/tasks/${taskId}`,
      {
        method: "PATCH",
        body: JSON.stringify(changes),
      },
      async () => {
        const task = tasksMock.find((item) => item.id === taskId);
        if (!task) {
          throw new ApiError("Task not found", 404);
        }

        applyTaskPatch(task, changes);
        return { ...task };
      },
    );
  }

  getPayments(params?: { include?: Array<"incomes" | "expenses"> }): Promise<Payment[]> {
    return this.request("/crm/payments", undefined, async () => {
      const includeIncomes = params?.include?.includes("incomes");
      const includeExpenses = params?.include?.includes("expenses");

      return paymentsMock.map((payment) => {
        const clone = clonePayment(payment);
        if (!includeIncomes) {
          clone.incomes = [];
        }
        if (!includeExpenses) {
          clone.expenses = [];
        }
        return clone;
      });
    });
  }

  createPayment(payload: PaymentPayload): Promise<Payment> {
    return this.request(
      "/crm/payments",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const now = new Date().toISOString();
        const deal = dealsMock.find((item) => item.id === payload.dealId);
        const client = clientsMock.find((item) => item.id === payload.clientId);
        const siblings = paymentsMock.filter((payment) => payment.policyNumber === payload.policyNumber);
        const nextSequence = siblings.length > 0 ? Math.max(...siblings.map((item) => item.sequence)) + 1 : 1;

        const payment: Payment = {
          id: createRandomId(),
          dealId: payload.dealId,
          dealName: deal?.name,
          clientId: payload.clientId,
          clientName: client?.name,
          policyId: payload.policyId ?? createRandomId(),
          policyNumber: payload.policyNumber,
          sequence: nextSequence,
          amount: payload.plannedAmount,
          plannedAmount: payload.plannedAmount,
          currency: payload.currency,
          status: payload.status ?? (payload.actualDate ? "received" : "planned"),
          paidAt: payload.actualDate ?? undefined,
          plannedDate: payload.plannedDate,
          dueDate: payload.plannedDate,
          actualDate: payload.actualDate ?? undefined,
          comment: payload.comment ?? undefined,
          incomesTotal: 0,
          expensesTotal: 0,
          netTotal: 0,
          incomes: [],
          expenses: [],
          createdAt: now,
          updatedAt: now,
          recordedBy: payload.recordedBy ?? undefined,
          updatedBy: payload.recordedBy ?? undefined,
        };

        paymentsMock.unshift(payment);
        return clonePayment(payment);
      },
    );
  }

  updatePayment(paymentId: string, payload: PaymentUpdatePayload): Promise<Payment> {
    return this.request(
      `/crm/payments/${paymentId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      async () => {
        const payment = paymentsMock.find((item) => item.id === paymentId);
        if (!payment) {
          throw new ApiError("Payment not found", 404);
        }

        if (payload.plannedAmount !== undefined) {
          payment.plannedAmount = payload.plannedAmount;
          payment.amount = payload.plannedAmount;
        }

        if (payload.plannedDate !== undefined) {
          payment.plannedDate = payload.plannedDate || undefined;
          payment.dueDate = payload.plannedDate || undefined;
        }

        if (payload.currency !== undefined) {
          payment.currency = payload.currency;
          payment.incomes = payment.incomes.map((income) => ({ ...income, currency: payload.currency! }));
          payment.expenses = payment.expenses.map((expense) => ({ ...expense, currency: payload.currency! }));
        }

        if (payload.status !== undefined) {
          payment.status = payload.status;
        }

        if (payload.comment !== undefined) {
          payment.comment = payload.comment ?? undefined;
        }

        if (payload.actualDate !== undefined) {
          payment.actualDate = payload.actualDate ?? undefined;
          payment.paidAt = payload.actualDate ?? undefined;
        }

        if (payload.recordedBy !== undefined) {
          payment.recordedBy = payload.recordedBy ?? undefined;
        }

        payment.updatedAt = new Date().toISOString();
        if (payload.recordedBy) {
          payment.updatedBy = payload.recordedBy;
        }

        return clonePayment(recalculateTotals(payment));
      },
    );
  }

  deletePayment(paymentId: string): Promise<{ id: string }> {
    return this.request(
      `/crm/payments/${paymentId}`,
      {
        method: "DELETE",
      },
      async () => {
        const index = paymentsMock.findIndex((item) => item.id === paymentId);
        if (index === -1) {
          throw new ApiError("Payment not found", 404);
        }

        paymentsMock.splice(index, 1);
        return { id: paymentId };
      },
    );
  }

  createPaymentIncome(paymentId: string, payload: PaymentEntryPayload): Promise<PaymentEntry> {
    return this.request(
      `/crm/payments/${paymentId}/incomes`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const payment = paymentsMock.find((item) => item.id === paymentId);
        if (!payment) {
          throw new ApiError("Payment not found", 404);
        }

        const now = new Date().toISOString();
        const income: PaymentEntry = {
          id: createRandomId(),
          paymentId,
          amount: payload.amount,
          currency: payment.currency,
          category: payload.category,
          postedAt: payload.postedAt,
          note: payload.note,
          createdAt: now,
          updatedAt: now,
        };

        payment.incomes.unshift(income);
        payment.updatedAt = now;
        recalculateTotals(payment);

        return { ...income };
      },
    );
  }

  updatePaymentIncome(paymentId: string, incomeId: string, payload: PaymentEntryPayload): Promise<PaymentEntry> {
    return this.request(
      `/crm/payments/${paymentId}/incomes/${incomeId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      async () => {
        const payment = paymentsMock.find((item) => item.id === paymentId);
        if (!payment) {
          throw new ApiError("Payment not found", 404);
        }

        const income = payment.incomes.find((item) => item.id === incomeId);
        if (!income) {
          throw new ApiError("Income not found", 404);
        }

        if (payload.amount !== undefined) {
          income.amount = payload.amount;
        }
        if (payload.category !== undefined) {
          income.category = payload.category;
        }
        if (payload.postedAt !== undefined) {
          income.postedAt = payload.postedAt;
        }
        if (payload.note !== undefined) {
          income.note = payload.note;
        }

        income.updatedAt = new Date().toISOString();
        payment.updatedAt = income.updatedAt;
        recalculateTotals(payment);

        return { ...income };
      },
    );
  }

  deletePaymentIncome(paymentId: string, incomeId: string): Promise<{ id: string }> {
    return this.request(
      `/crm/payments/${paymentId}/incomes/${incomeId}`,
      {
        method: "DELETE",
      },
      async () => {
        const payment = paymentsMock.find((item) => item.id === paymentId);
        if (!payment) {
          throw new ApiError("Payment not found", 404);
        }

        const index = payment.incomes.findIndex((item) => item.id === incomeId);
        if (index === -1) {
          throw new ApiError("Income not found", 404);
        }

        payment.incomes.splice(index, 1);
        payment.updatedAt = new Date().toISOString();
        recalculateTotals(payment);

        return { id: incomeId };
      },
    );
  }

  createPaymentExpense(paymentId: string, payload: PaymentEntryPayload): Promise<PaymentEntry> {
    return this.request(
      `/crm/payments/${paymentId}/expenses`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const payment = paymentsMock.find((item) => item.id === paymentId);
        if (!payment) {
          throw new ApiError("Payment not found", 404);
        }

        const now = new Date().toISOString();
        const expense: PaymentEntry = {
          id: createRandomId(),
          paymentId,
          amount: payload.amount,
          currency: payment.currency,
          category: payload.category,
          postedAt: payload.postedAt,
          note: payload.note,
          createdAt: now,
          updatedAt: now,
        };

        payment.expenses.unshift(expense);
        payment.updatedAt = now;
        recalculateTotals(payment);

        return { ...expense };
      },
    );
  }

  updatePaymentExpense(paymentId: string, expenseId: string, payload: PaymentEntryPayload): Promise<PaymentEntry> {
    return this.request(
      `/crm/payments/${paymentId}/expenses/${expenseId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      async () => {
        const payment = paymentsMock.find((item) => item.id === paymentId);
        if (!payment) {
          throw new ApiError("Payment not found", 404);
        }

        const expense = payment.expenses.find((item) => item.id === expenseId);
        if (!expense) {
          throw new ApiError("Expense not found", 404);
        }

        if (payload.amount !== undefined) {
          expense.amount = payload.amount;
        }
        if (payload.category !== undefined) {
          expense.category = payload.category;
        }
        if (payload.postedAt !== undefined) {
          expense.postedAt = payload.postedAt;
        }
        if (payload.note !== undefined) {
          expense.note = payload.note;
        }

        expense.updatedAt = new Date().toISOString();
        payment.updatedAt = expense.updatedAt;
        recalculateTotals(payment);

        return { ...expense };
      },
    );
  }

  deletePaymentExpense(paymentId: string, expenseId: string): Promise<{ id: string }> {
    return this.request(
      `/crm/payments/${paymentId}/expenses/${expenseId}`,
      {
        method: "DELETE",
      },
      async () => {
        const payment = paymentsMock.find((item) => item.id === paymentId);
        if (!payment) {
          throw new ApiError("Payment not found", 404);
        }

        const index = payment.expenses.findIndex((item) => item.id === expenseId);
        if (index === -1) {
          throw new ApiError("Expense not found", 404);
        }

        payment.expenses.splice(index, 1);
        payment.updatedAt = new Date().toISOString();
        recalculateTotals(payment);

        return { id: expenseId };
      },
    );
  async bulkUpdateTasks(
    taskIds: string[],
    payload: UpdateTaskPayload,
    options?: { shiftDueDateByDays?: number },
  ): Promise<Task[]> {
    const changes = sanitizeTaskPatch(payload);

    return this.request(
      `/crm/tasks/bulk`,
      {
        method: "PATCH",
        body: JSON.stringify({ taskIds, changes, options }),
      },
      async () => {
        const updated: Task[] = [];

        for (const taskId of taskIds) {
          const task = tasksMock.find((item) => item.id === taskId);
          if (!task) {
            continue;
          }

          const patch: UpdateTaskPayload = { ...changes };

          if (options?.shiftDueDateByDays) {
            const dueDate = new Date(task.dueDate);
            dueDate.setDate(dueDate.getDate() + options.shiftDueDateByDays);
            patch.dueDate = dueDate.toISOString();
          }

          applyTaskPatch(task, patch);
          updated.push({ ...task });
        }

        if (updated.length === 0) {
          throw new ApiError("Tasks not found", 404);
        }

        return updated;
      },
    );
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    return this.updateTask(taskId, { status, completed: status === "done" });
  }

  getPayments(): Promise<Payment[]> {
    return this.request("/crm/payments", undefined, async () => paymentsMock);
  }

  getClientActivities(clientId: string): Promise<ActivityLogEntry[]> {
    return this.request(`/crm/clients/${clientId}/activity`, undefined, async () =>
      activitiesMock.filter((entry) => entry.clientId === clientId),
    );
  }
}

function clonePayment(payment: Payment): Payment {
  return {
    ...payment,
    incomes: payment.incomes.map((income) => ({ ...income })),
    expenses: payment.expenses.map((expense) => ({ ...expense })),
  };
}

function recalculateTotals(payment: Payment): Payment {
  const incomesTotal = payment.incomes.reduce((sum, income) => sum + income.amount, 0);
  const expensesTotal = payment.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  payment.incomesTotal = incomesTotal;
  payment.expensesTotal = expensesTotal;
  payment.netTotal = incomesTotal - expensesTotal;
  payment.amount = payment.plannedAmount;
  return payment;
function sanitizeTaskPatch(patch: UpdateTaskPayload): UpdateTaskPayload {
  const result: UpdateTaskPayload = {};

  for (const key of Object.keys(patch) as Array<keyof UpdateTaskPayload>) {
    const value = patch[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

function applyTaskPatch(task: Task, patch: UpdateTaskPayload): Task {
  if (patch.status) {
    task.status = patch.status;
    task.completed = patch.completed ?? patch.status === "done";
  }

  if (patch.completed !== undefined && !patch.status) {
    task.completed = patch.completed;
    if (patch.completed) {
      task.status = "done";
    } else if (task.status === "done") {
      task.status = "in_progress";
    }
  }

  if (patch.owner !== undefined) {
    task.owner = patch.owner;
  }

  if (patch.dueDate !== undefined) {
    task.dueDate = patch.dueDate;
  }

  if (patch.tags !== undefined) {
    task.tags = [...patch.tags];
  }

  if (patch.type !== undefined) {
    task.type = patch.type;
  }

  if (patch.reminderAt !== undefined) {
    task.reminderAt = patch.reminderAt;
  }

  return task;
}

const DAY_IN_MS = 86_400_000;

const DEAL_STAGE_ORDER: DealStage[] = [
  "qualification",
  "negotiation",
  "proposal",
  "closedWon",
  "closedLost",
];

function getPeriodStart(period: DealPeriodFilter | undefined): number | undefined {
  switch (period) {
    case "7d":
      return Date.now() - DAY_IN_MS * 7;
    case "30d":
      return Date.now() - DAY_IN_MS * 30;
    case "90d":
      return Date.now() - DAY_IN_MS * 90;
    default:
      return undefined;
  }
}

function filterDealsMock(deals: Deal[], filters?: DealFilters): Deal[] {
  const managerNames = new Set<string>();
  const includeNoManager = (filters?.managers ?? []).some((manager) => manager === NO_MANAGER_VALUE);

  for (const manager of filters?.managers ?? []) {
    if (!manager || manager === NO_MANAGER_VALUE) {
      continue;
    }

    managerNames.add(manager.toLowerCase());
  }
  const search = filters?.search?.trim().toLowerCase();
  const periodStart = getPeriodStart(filters?.period);
  const stageFilter = filters?.stage && filters.stage !== "all" ? filters.stage : undefined;

  return deals
    .map((deal, index) => ({ deal, index }))
    .filter(({ deal }) => {
      if (stageFilter && deal.stage !== stageFilter) {
        return false;
      }

      const hasManagerFilter = includeNoManager || managerNames.size > 0;

      if (hasManagerFilter) {
        const owner = deal.owner?.trim();

        if (!owner) {
          return includeNoManager;
        }

        if (managerNames.size > 0 && !managerNames.has(owner.toLowerCase())) {
          return false;
        }

      }

      if (periodStart && new Date(deal.updatedAt).getTime() < periodStart) {
        return false;
      }

      if (search) {
        const haystack = `${deal.name} ${deal.clientName}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      return true;
    })
    .map(({ deal, index }) => ({ deal: { ...deal }, index }))
    .sort((a, b) => {
      const diff = compareDealsByNextReview(a.deal, b.deal);
      if (diff !== 0) {
        return diff;
      }

      return a.index - b.index;
    })
    .map((entry) => entry.deal);
}

function calculateStageMetrics(deals: Deal[]): DealStageMetrics[] {
  const baselineCount = deals.filter((deal) => deal.stage === "qualification").length;
  const now = Date.now();

  return DEAL_STAGE_ORDER.map((stage, index) => {
    const stageDeals = deals.filter((deal) => deal.stage === stage);
    const count = stageDeals.length;
    const totalValue = stageDeals.reduce((acc, deal) => acc + deal.value, 0);
    const conversionRate =
      index === 0
        ? 1
        : baselineCount > 0
          ? Math.max(0, Math.min(1, count / baselineCount))
          : 0;
    const avgCycleDurationDays =
      stageDeals.length === 0
        ? null
        : Number.parseFloat(
            (
              stageDeals.reduce((acc, deal) => acc + (now - new Date(deal.updatedAt).getTime()), 0) /
              stageDeals.length /
              DAY_IN_MS
            ).toFixed(1),
          );

    return {
      stage,
      count,
      totalValue,
      conversionRate,
      avgCycleDurationDays,
    } satisfies DealStageMetrics;
  });
}

function updateDealStageMock(dealId: string, stage: DealStage): Deal {
  const deal = dealsMock.find((item) => item.id === dealId);

  if (!deal) {
    throw new ApiError("Deal not found", 404);
  }

  deal.stage = stage;
  deal.updatedAt = new Date().toISOString();

  const details = dealDetailsMock[dealId];
  if (details) {
    details.stage = stage;
    details.updatedAt = deal.updatedAt;
  }

  return { ...deal };
}

export const apiClient = new ApiClient();

export function createApiClient(config: ApiClientConfig = {}) {
  return new ApiClient(config);
}
