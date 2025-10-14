import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, afterEach, vi } from "vitest";
import { PaymentsTable } from "@/components/payments/PaymentsTable";
import { renderWithQueryClient } from "@/test-utils";
import type { Payment } from "@/types/crm";

const confirmPaymentMock = vi.fn();
const revokePaymentMock = vi.fn();

vi.mock("@/lib/api/hooks", () => {
  const stubMutation = (mock: ReturnType<typeof vi.fn> = vi.fn()) => ({ mutateAsync: mock, isPending: false });
  return {
    usePayments: vi.fn(),
    useCreatePayment: () => stubMutation(),
    useUpdatePayment: () => stubMutation(),
    useDeletePayment: () => stubMutation(),
    useCreatePaymentIncome: () => stubMutation(),
    useUpdatePaymentIncome: () => stubMutation(),
    useDeletePaymentIncome: () => stubMutation(),
    useCreatePaymentExpense: () => stubMutation(),
    useUpdatePaymentExpense: () => stubMutation(),
    useDeletePaymentExpense: () => stubMutation(),
    useConfirmPayment: () => stubMutation(confirmPaymentMock),
    useRevokePaymentConfirmation: () => stubMutation(revokePaymentMock),
  };
});

import { usePayments as mockedUsePayments } from "@/lib/api/hooks";

const usePayments = vi.mocked(mockedUsePayments);

afterEach(() => {
  vi.clearAllMocks();
  confirmPaymentMock.mockReset();
  revokePaymentMock.mockReset();
});

describe("PaymentsTable", () => {
  it("показывает состояние загрузки", () => {
    usePayments.mockReturnValue({ data: [], isLoading: true, isError: false, error: null });

    const { container } = renderWithQueryClient(<PaymentsTable />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("отображает пустое состояние", () => {
    usePayments.mockReturnValue({ data: [], isLoading: false, isError: false, error: null });

    renderWithQueryClient(<PaymentsTable />);

    expect(screen.getByText(/Платежи ещё не созданы/i)).toBeInTheDocument();
  });

  it("отображает сообщение об ошибке", () => {
    usePayments.mockReturnValue({ data: [], isLoading: false, isError: true, error: new Error("Ошибка сервера") });

    renderWithQueryClient(<PaymentsTable />);

    expect(screen.getByText(/Не удалось загрузить платежи: Ошибка сервера/i)).toBeInTheDocument();
  });

  it("фильтрует платежи по расходам", async () => {
    const samplePayments: Payment[] = [
      {
        id: "p-1",
        dealId: "deal-1",
        dealName: "Сделка 1",
        clientId: "client-1",
        clientName: "Клиент 1",
        policyNumber: "CR-1",
        policyId: "policy-1",
        sequence: 1,
        amount: 100000,
        plannedAmount: 100000,
        currency: "RUB",
        status: "planned",
        confirmationStatus: "pending",
        dueDate: new Date().toISOString(),
        plannedDate: new Date().toISOString(),
        actualDate: undefined,
        comment: "",
        incomesTotal: 50000,
        expensesTotal: 0,
        netTotal: 50000,
        incomes: [],
        expenses: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recordedBy: undefined,
        recordedByRole: undefined,
        updatedBy: undefined,
        paidAt: undefined,
        actualAmount: undefined,
        history: [],
      },
      {
        id: "p-2",
        dealId: "deal-2",
        dealName: "Сделка 2",
        clientId: "client-2",
        clientName: "Клиент 2",
        policyNumber: "CR-2",
        policyId: "policy-2",
        sequence: 1,
        amount: 200000,
        plannedAmount: 200000,
        currency: "RUB",
        status: "expected",
        confirmationStatus: "pending",
        dueDate: new Date().toISOString(),
        plannedDate: new Date().toISOString(),
        actualDate: undefined,
        comment: "",
        incomesTotal: 0,
        expensesTotal: 100000,
        netTotal: -100000,
        incomes: [],
        expenses: [
          {
            id: "expense-1",
            paymentId: "p-2",
            amount: 100000,
            plannedAmount: 100000,
            actualAmount: null,
            currency: "RUB",
            category: "agent_fee",
            postedAt: new Date().toISOString(),
            note: "",
            status: "pending_confirmation",
            adjustmentReason: null,
            attachments: [],
            history: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: undefined,
            updatedBy: undefined,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recordedBy: undefined,
        recordedByRole: undefined,
        updatedBy: undefined,
        paidAt: undefined,
        actualAmount: undefined,
        history: [],
      },
    ];

    usePayments.mockReturnValue({ data: samplePayments, isLoading: false, isError: false, error: null });

    const user = userEvent.setup();
    renderWithQueryClient(<PaymentsTable />);

    await user.click(screen.getByRole("button", { name: "Расходы" }));

    expect(screen.getByText(/Полис CR-2/)).toBeInTheDocument();
    expect(screen.queryByText(/Полис CR-1/)).not.toBeInTheDocument();
  });

  it("подтверждает платёж через модальное окно", async () => {
    const payment: Payment = {
      id: "payment-confirm",
      dealId: "deal-10",
      dealName: "Сделка 10",
      clientId: "client-10",
      clientName: "Клиент 10",
      policyId: "policy-10",
      policyNumber: "CR-10",
      sequence: 1,
      amount: 120000,
      plannedAmount: 120000,
      currency: "RUB",
      status: "expected",
      confirmationStatus: "pending",
      dueDate: new Date().toISOString(),
      plannedDate: new Date().toISOString(),
      actualDate: undefined,
      comment: "",
      incomesTotal: 0,
      expensesTotal: 0,
      netTotal: 0,
      incomes: [],
      expenses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recordedBy: "Анна Савельева",
      recordedByRole: "Главный админ",
      updatedBy: "Анна Савельева",
      paidAt: undefined,
      actualAmount: undefined,
      history: [],
    };

    confirmPaymentMock.mockResolvedValue(payment);
    usePayments.mockReturnValue({ data: [payment], isLoading: false, isError: false, error: null });

    const user = userEvent.setup();
    renderWithQueryClient(<PaymentsTable />);

    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const dialog = screen.getByRole("dialog", { name: /Подтверждение платежа/i });
    const confirmButton = within(dialog).getByRole("button", { name: "Подтвердить" });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(confirmPaymentMock).toHaveBeenCalledWith({
        paymentId: payment.id,
        payload: expect.objectContaining({
          actualAmount: payment.plannedAmount,
          recordedBy: payment.recordedBy,
        }),
      });
    });
  });

  it("отменяет подтверждение платежа", async () => {
    const payment: Payment = {
      id: "payment-revoke",
      dealId: "deal-20",
      dealName: "Сделка 20",
      clientId: "client-20",
      clientName: "Клиент 20",
      policyId: "policy-20",
      policyNumber: "CR-20",
      sequence: 1,
      amount: 90000,
      plannedAmount: 90000,
      currency: "RUB",
      status: "received",
      confirmationStatus: "confirmed",
      dueDate: new Date().toISOString(),
      plannedDate: new Date().toISOString(),
      actualDate: new Date().toISOString(),
      comment: "",
      incomesTotal: 90000,
      expensesTotal: 0,
      netTotal: 90000,
      incomes: [],
      expenses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recordedBy: "Иван Плахов",
      recordedByRole: "Менеджер",
      updatedBy: "Иван Плахов",
      paidAt: new Date().toISOString(),
      actualAmount: 90000,
      history: [],
    };

    revokePaymentMock.mockResolvedValue(payment);
    usePayments.mockReturnValue({ data: [payment], isLoading: false, isError: false, error: null });

    const user = userEvent.setup();
    renderWithQueryClient(<PaymentsTable />);

    await user.click(screen.getByRole("button", { name: "Отменить подтверждение" }));
    await user.click(screen.getByRole("button", { name: "Сбросить подтверждение" }));

    await waitFor(() => {
      expect(revokePaymentMock).toHaveBeenCalledWith({
        paymentId: payment.id,
        payload: expect.objectContaining({
          recordedBy: payment.updatedBy,
        }),
      });
    });
  });

  it("требует указать причину изменения перед сохранением", async () => {
    const payment: Payment = {
      id: "payment-edit",
      dealId: "deal-30",
      dealName: "Сделка 30",
      clientId: "client-30",
      clientName: "Клиент 30",
      policyId: "policy-30",
      policyNumber: "CR-30",
      sequence: 1,
      amount: 50000,
      plannedAmount: 50000,
      currency: "RUB",
      status: "planned",
      confirmationStatus: "pending",
      dueDate: new Date().toISOString(),
      plannedDate: new Date().toISOString(),
      actualDate: undefined,
      comment: "",
      incomesTotal: 0,
      expensesTotal: 0,
      netTotal: 0,
      incomes: [],
      expenses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recordedBy: "Мария Орлова",
      recordedByRole: "Исполнитель",
      updatedBy: "Мария Орлова",
      paidAt: undefined,
      actualAmount: undefined,
      history: [],
    };

    usePayments.mockReturnValue({ data: [payment], isLoading: false, isError: false, error: null });

    const user = userEvent.setup();
    renderWithQueryClient(<PaymentsTable />);

    await user.click(screen.getByRole("button", { name: "Редактировать" }));

    const dialog = screen.getByRole("dialog", { name: /Редактирование платежа/i });
    const saveButton = within(dialog).getByRole("button", { name: "Сохранить" });
    expect(saveButton).toBeDisabled();

    const reasonField = within(dialog).getByPlaceholderText(/Опишите, что изменилось/i);
    await user.type(reasonField, "слишком");
    expect(within(dialog).getByText(/Причина должна содержать/i)).toBeInTheDocument();

    await user.clear(reasonField);
    await user.type(reasonField, "Причина изменения больше десяти символов");
    expect(saveButton).not.toBeDisabled();
  });
});
