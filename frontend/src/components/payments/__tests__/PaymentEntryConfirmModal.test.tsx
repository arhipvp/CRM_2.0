import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PaymentEntryConfirmModal } from "@/components/payments/PaymentEntryConfirmModal";
import type { Payment, PaymentEntry } from "@/types/crm";

const baseEntry: PaymentEntry = {
  id: "entry-1",
  paymentId: "payment-1",
  amount: 50000,
  plannedAmount: 50000,
  actualAmount: null,
  currency: "RUB",
  category: "client_payment",
  postedAt: "2024-02-01T00:00:00.000Z",
  actualPostedAt: null,
  note: "",
  status: "pending_confirmation",
  adjustmentReason: null,
  attachments: [],
  history: [],
  createdAt: "2024-01-10T00:00:00.000Z",
  updatedAt: "2024-01-10T00:00:00.000Z",
  createdBy: "user-1",
  updatedBy: "user-1",
};

const basePayment: Payment = {
  id: "payment-1",
  dealId: "deal-1",
  dealName: "Сделка",
  clientId: "client-1",
  clientName: "Клиент",
  policyId: "policy-1",
  policyNumber: "POL-1",
  sequence: 1,
  amount: 100000,
  plannedAmount: 100000,
  currency: "RUB",
  status: "planned",
  paidAt: undefined,
  dueDate: "2024-02-10T00:00:00.000Z",
  plannedDate: "2024-02-01T00:00:00.000Z",
  actualDate: undefined,
  comment: "",
  incomesTotal: 50000,
  expensesTotal: 10000,
  netTotal: 40000,
  incomes: [baseEntry],
  expenses: [],
  createdAt: "2024-01-05T00:00:00.000Z",
  updatedAt: "2024-01-05T00:00:00.000Z",
  recordedBy: "user-1",
  updatedBy: "user-1",
};

describe("PaymentEntryConfirmModal", () => {
  it("валидирует поля и отправляет данные с влиянием на агрегаты", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <PaymentEntryConfirmModal
        type="income"
        isOpen
        entry={baseEntry}
        payment={basePayment}
        currency="RUB"
        onSubmit={onSubmit}
        onClose={() => undefined}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: "Подтвердить" });
    expect(confirmButton).toBeDisabled();

    const amountInput = screen.getByLabelText(/Фактическая сумма/i);
    const dateInput = screen.getByLabelText(/Фактическая дата/i);

    await user.type(amountInput, "60000");
    await user.type(dateInput, "2024-01-25");

    expect(screen.getByText(/Дата не может быть раньше плановой/i)).toBeInTheDocument();
    expect(confirmButton).toBeDisabled();

    await user.clear(dateInput);
    await user.type(dateInput, "2024-02-05");

    const reasonSelect = screen.getByLabelText(/Причина/i);
    await user.selectOptions(reasonSelect, "correction");

    const noteInput = screen.getByLabelText(/Комментарий/i);
    await user.type(noteInput, "Факт подтверждён");

    const fileInput = screen.getByLabelText(/Вложения/i);
    const file = new File(["контракт"], "evidence.pdf", { type: "application/pdf" });
    await user.upload(fileInput, file);

    expect(screen.getByText(/evidence.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/Влияние на агрегаты/i)).toBeInTheDocument();
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(onSubmit).toHaveBeenCalledWith({
      actualAmount: 60000,
      actualPostedAt: "2024-02-05",
      reason: "correction",
      note: "Факт подтверждён",
      attachments: [file],
    });
  });
});
