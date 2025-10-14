import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, afterEach, vi } from "vitest";
import { PaymentsTable } from "@/components/payments/PaymentsTable";
import { renderWithQueryClient } from "@/test-utils";
import type { Payment } from "@/types/crm";

vi.mock("@/lib/api/hooks", () => {
  const stubMutation = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    usePayments: vi.fn(),
    useCreatePayment: stubMutation,
    useUpdatePayment: stubMutation,
    useDeletePayment: stubMutation,
    useCreatePaymentIncome: stubMutation,
    useUpdatePaymentIncome: stubMutation,
    useDeletePaymentIncome: stubMutation,
    useCreatePaymentExpense: stubMutation,
    useUpdatePaymentExpense: stubMutation,
    useDeletePaymentExpense: stubMutation,
  };
});

import { usePayments as mockedUsePayments } from "@/lib/api/hooks";

const usePayments = vi.mocked(mockedUsePayments);

afterEach(() => {
  vi.clearAllMocks();
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
        updatedBy: undefined,
        paidAt: undefined,
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
            currency: "RUB",
            category: "agent_fee",
            postedAt: new Date().toISOString(),
            note: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: undefined,
            updatedBy: undefined,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recordedBy: undefined,
        updatedBy: undefined,
        paidAt: undefined,
      },
    ];

    usePayments.mockReturnValue({ data: samplePayments, isLoading: false, isError: false, error: null });

    const user = userEvent.setup();
    renderWithQueryClient(<PaymentsTable />);

    await user.click(screen.getByRole("button", { name: "Расходы" }));

    expect(screen.getByText(/Полис CR-2/)).toBeInTheDocument();
    expect(screen.queryByText(/Полис CR-1/)).not.toBeInTheDocument();
  });
});
