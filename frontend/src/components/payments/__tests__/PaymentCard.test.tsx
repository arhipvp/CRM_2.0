import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaymentCard } from "../PaymentCard";
import type { Payment } from "@/types/crm";

describe("PaymentCard", () => {
  const basePayment: Payment = {
    id: "payment-test",
    dealId: "deal-test",
    dealName: "Тестовая сделка",
    clientId: "client-test",
    clientName: "Тестовый клиент",
    policyId: "policy-test",
    policyNumber: "PT-01",
    sequence: 1,
    amount: 50000,
    plannedAmount: 50000,
    currency: "RUB",
    status: "planned",
    confirmationStatus: "pending",
    actualAmount: 45000,
    paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    dueDate: new Date().toISOString(),
    plannedDate: new Date().toISOString(),
    actualDate: new Date().toISOString(),
    comment: "Комментарий к платежу",
    incomesTotal: 45000,
    expensesTotal: 5000,
    netTotal: 40000,
    incomes: [
      {
        id: "income-test",
        paymentId: "payment-test",
        amount: 45000,
        plannedAmount: 50000,
        actualAmount: 45000,
        currency: "RUB",
        category: "Комиссия",
        postedAt: new Date().toISOString(),
        actualPostedAt: new Date().toISOString(),
        note: "",
        status: "confirmed",
        adjustmentReason: null,
        attachments: [
          {
            id: "attach-1",
            fileName: "Договор.pdf",
            fileSize: 1024 * 300,
            uploadedAt: new Date().toISOString(),
            uploadedBy: "Иван Иванов",
            url: "https://example.com/contract.pdf",
          },
        ],
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "Иван Иванов",
        updatedBy: "Иван Иванов",
      },
    ],
    expenses: [
      {
        id: "expense-test",
        paymentId: "payment-test",
        amount: 5000,
        plannedAmount: 5000,
        actualAmount: 5000,
        currency: "RUB",
        category: "Сбор банка",
        postedAt: new Date().toISOString(),
        actualPostedAt: new Date().toISOString(),
        note: "",
        status: "confirmed",
        adjustmentReason: null,
        attachments: [
          {
            id: "attach-2",
            fileName: "Квитанция.pdf",
            fileSize: 1024 * 120,
            uploadedAt: new Date().toISOString(),
            uploadedBy: "Пётр Петров",
            url: undefined,
          },
        ],
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "Пётр Петров",
        updatedBy: "Пётр Петров",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    recordedBy: "Мария Сидорова",
    recordedByRole: "Финансовый контролёр",
    updatedBy: "Мария Сидорова",
    history: [
      {
        id: "change-test",
        changedAt: new Date().toISOString(),
        changedBy: "Мария Сидорова",
        reason: "Обновление суммы",
        snapshot: {
          plannedAmount: 50000,
          actualAmount: 45000,
          plannedDate: new Date().toISOString(),
          actualDate: new Date().toISOString(),
          status: "received",
        },
      },
    ],
  };

  const defaultHandlers = {
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onAddIncome: vi.fn(),
    onAddExpense: vi.fn(),
    onEditIncome: vi.fn(),
    onDeleteIncome: vi.fn(),
    onConfirmIncome: vi.fn(),
    onEditExpense: vi.fn(),
    onDeleteExpense: vi.fn(),
    onConfirm: vi.fn(),
    onRevokeConfirmation: vi.fn(),
    onConfirmExpense: vi.fn(),
  };

  it("отображает историю изменений и связанные документы", () => {
    render(
      <PaymentCard
        payment={basePayment}
        expanded
        isConfirming={false}
        isRevoking={false}
        {...defaultHandlers}
      />,
    );

    expect(screen.getByText("История изменений")).toBeInTheDocument();
    expect(screen.getByText("Обновление суммы")).toBeInTheDocument();
    expect(screen.getByText("Связанные документы")).toBeInTheDocument();
    expect(screen.getAllByText("Договор.pdf")).toHaveLength(2);
    expect(screen.getByText("Источник: Поступление • Комиссия")).toBeInTheDocument();
    expect(screen.getByText("Источник: Расход • Сбор банка")).toBeInTheDocument();
  });

  it("показывает пустые состояния при отсутствии истории и вложений", () => {
    const payment: Payment = {
      ...basePayment,
      id: "payment-empty",
      history: [],
      incomes: basePayment.incomes.map((income) => ({
        ...income,
        id: `${income.id}-empty`,
        attachments: [],
      })),
      expenses: basePayment.expenses.map((expense) => ({
        ...expense,
        id: `${expense.id}-empty`,
        attachments: [],
      })),
    };

    render(
      <PaymentCard
        payment={payment}
        expanded
        isConfirming={false}
        isRevoking={false}
        {...defaultHandlers}
      />,
    );

    expect(screen.getByText("История изменений пока пуста.")).toBeInTheDocument();
    expect(screen.getByText("Документы ещё не прикреплены.")).toBeInTheDocument();
  });
});
