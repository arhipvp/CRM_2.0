import React from "react";
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { dealsQueryOptions } from "@/lib/api/queries";
import { dealsMock } from "@/mocks/data";
import { DealFunnelBoard } from "@/components/deals/DealFunnelBoard";
import { createTestQueryClient, renderWithQueryClient } from "@/test-utils";

describe("DealFunnelBoard", () => {
  it("отображает сделки по стадиям", async () => {
    const client = createTestQueryClient();
    client.setQueryData(dealsQueryOptions().queryKey, dealsMock);

    renderWithQueryClient(<DealFunnelBoard />, client);

    expect(await screen.findByText("Квалификация"));
    expect(screen.getByText("Переговоры"));
    expect(screen.getAllByText(/Страховка|ДМС|КАСКО/i).length).toBeGreaterThan(0);
  });
});
