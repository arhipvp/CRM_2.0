import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paymentsQueryOptions } from "@/lib/api/queries";
import { paymentsMock } from "@/mocks/data";
import { PaymentsTable } from "@/components/payments/PaymentsTable";
import { createTestQueryClient, renderWithQueryClient } from "@/test-utils";

describe("PaymentsTable", () => {
  it("отображает статусы платежей", async () => {
    const client = createTestQueryClient();
    client.setQueryData(paymentsQueryOptions().queryKey, paymentsMock);

    renderWithQueryClient(<PaymentsTable />, client);

    expect(await screen.findByText(/Оплачен/)).toBeInTheDocument();
    expect(screen.getByText(/Ошибка/)).toBeInTheDocument();
    expect(screen.getByText(/В ожидании/)).toBeInTheDocument();
  });
});
