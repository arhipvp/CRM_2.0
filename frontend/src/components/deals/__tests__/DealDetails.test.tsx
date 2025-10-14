import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { DealDetails } from "@/components/deals/DealDetails";
import { dealDetailsMock } from "@/mocks/data";
import type { DealDetailsData } from "@/types/crm";

const useDealDetailsMock = vi.fn();
const useUpdateDealMock = vi.fn();

vi.mock("@/lib/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hooks")>();
  return {
    ...actual,
    useDealDetails: (...args: unknown[]) => useDealDetailsMock(...args),
    useUpdateDeal: (...args: unknown[]) => useUpdateDealMock(...args),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("DealDetails", () => {
  it("отображает состояние загрузки", () => {
    useDealDetailsMock.mockReturnValue({ isLoading: true });
    useUpdateDealMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<DealDetails dealId="deal-1" />);

    expect(screen.getByRole("status", { hidden: true })).toBeInTheDocument();
  });

  it("отображает ошибку", () => {
    useDealDetailsMock.mockReturnValue({ isLoading: false, isError: true, error: new Error("Ошибка"), refetch: vi.fn() });
    useUpdateDealMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<DealDetails dealId="deal-1" />);

    expect(screen.getByText(/Не удалось загрузить сделку/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /повторить/i })).toBeInTheDocument();
  });

  it("отображает данные сделки и переключает вкладки", async () => {
    const deal = dealDetailsMock["deal-1"] satisfies DealDetailsData;

    useDealDetailsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: deal,
      refetch: vi.fn(),
    });
    useUpdateDealMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<DealDetails dealId="deal-1" />);

    expect(screen.getByRole("heading", { name: deal.name })).toBeInTheDocument();
    expect(screen.getByText(/Текущий полис/)).toBeInTheDocument();

    const user = userEvent.setup();

    const formsTab = screen.getByRole("button", { name: /Формы/i });
    await user.click(formsTab);

    expect(await screen.findByText(/Название сделки/)).toBeInTheDocument();

    const calculationsTab = screen.getByRole("button", { name: /Расчёты/i });
    await user.click(calculationsTab);

    expect(await screen.findByText(/Страховая компания/)).toBeInTheDocument();

    const docsTab = screen.getByRole("button", { name: /Документы/i });
    await user.click(docsTab);

    expect(await screen.findByText(/Перетащите файлы сюда/i)).toBeInTheDocument();
  });
});
