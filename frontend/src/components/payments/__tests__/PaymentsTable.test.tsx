import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paymentsQueryOptions } from "@/lib/api/queries";
import { paymentsMock } from "@/mocks/data";
import { PaymentsTable } from "@/components/payments/PaymentsTable";
import { createTestQueryClient, renderWithQueryClient } from "@/test-utils";

describe("PaymentsTable", () => {
  it("отображает все поддерживаемые статусы платежей", async () => {
    const client = createTestQueryClient();
    client.setQueryData(paymentsQueryOptions().queryKey, paymentsMock);

    renderWithQueryClient(<PaymentsTable />, client);

    const labels = ["Запланирован", "Ожидается", "Получен", "Выплачен", "Отменён"];

    for (const label of labels) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
  });
});
