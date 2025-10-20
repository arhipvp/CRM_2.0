import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DealCreateModal } from "@/components/deals/DealCreateModal";
import { clientsMock, dealsMock } from "@/mocks/data";
import { renderWithQueryClient } from "@/test-utils";
import type { Deal } from "@/types/crm";

const mutateAsyncMock = vi.fn();

vi.mock("@/lib/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hooks")>();

  return {
    ...actual,
    useCreateDeal: () => ({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    }),
  };
});

describe("DealCreateModal", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
  });

  it("показывает ошибки валидации при пустых значениях", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <DealCreateModal
        isOpen
        onClose={() => {}}
        clients={clientsMock}
        owners={[]}
      />,
    );

    await user.clear(screen.getByLabelText("Следующий просмотр"));
    await user.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByText("Укажите название сделки")).toBeInTheDocument();
    expect(screen.getByText("Выберите клиента", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Укажите корректную дату")).toBeInTheDocument();
  });

  it("отправляет форму и вызывает колбэки", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDealCreated = vi.fn();
    const reviewValue = "2025-05-01T10:00";
    const createdDeal: Deal = {
      ...dealsMock[0],
      id: "deal-created",
      name: "Новая сделка",
      clientId: clientsMock[0].id,
      clientName: clientsMock[0].name,
      owner: "Анна Савельева",
      nextReviewAt: new Date(reviewValue).toISOString(),
    };

    mutateAsyncMock.mockResolvedValue(createdDeal);

    renderWithQueryClient(
      <DealCreateModal
        isOpen
        onClose={onClose}
        clients={clientsMock}
        owners={["Анна Савельева", "Мария Орлова"]}
        onDealCreated={onDealCreated}
      />,
    );

    await user.type(screen.getByLabelText("Название сделки"), "Новая сделка");
    await user.selectOptions(screen.getByLabelText("Клиент"), clientsMock[0].id);
    await user.clear(screen.getByLabelText("Следующий просмотр"));
    await user.type(screen.getByLabelText("Следующий просмотр"), reviewValue);
    await user.selectOptions(screen.getByLabelText("Ответственный (опционально)"), "Анна Савельева");
    await user.type(screen.getByLabelText("Описание (опционально)"), "Тестовое описание");

    await user.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    const call = mutateAsyncMock.mock.calls[0]?.[0];
    expect(call?.payload).toMatchObject({
      name: "Новая сделка",
      clientId: clientsMock[0].id,
      nextReviewAt: new Date(reviewValue).toISOString(),
      ownerId: "Анна Савельева",
      description: "Тестовое описание",
    });
    expect(typeof call?.optimisticUpdater).toBe("function");
    expect(call?.optimisticDealId).toMatch(/^deal-temp-/);

    await waitFor(() => {
      expect(onDealCreated).toHaveBeenCalledWith(createdDeal);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("фильтрует список клиентов по поиску и сохраняет выбранный пункт", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <DealCreateModal
        isOpen
        onClose={() => {}}
        clients={clientsMock}
        owners={[]}
      />,
    );

    const clientSearchInput = screen.getByPlaceholderText("Начните вводить имя клиента");
    const clientSelect = screen.getByLabelText("Клиент");

    await user.selectOptions(clientSelect, clientsMock[1].id);
    await user.type(clientSearchInput, "ооо");

    const options = within(clientSelect).getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[1]).toHaveTextContent(clientsMock[1].name);
    expect(options[1].selected).toBe(true);
    expect(options[2]).toHaveTextContent(clientsMock[0].name);
    expect(options.map((option) => option.textContent)).not.toContain(clientsMock[2].name);
  });
});

