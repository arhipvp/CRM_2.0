import { afterEach, describe, expect, it } from "vitest";

import { PaymentEventPayload, useUiStore } from "@/stores/uiStore";

const initialState = useUiStore.getState();

afterEach(() => {
  useUiStore.setState(initialState, true);
});

describe("useUiStore", () => {
  describe("ui filters and selection", () => {
    it("изменяет вид канбана на таблицу", () => {
      useUiStore.getState().setViewMode("table");

      expect(useUiStore.getState().viewMode).toBe("table");
    });

    it("обновляет стадию и менеджеров без мутаций", () => {
      const managers = ["mgr-1", "mgr-2"];

      useUiStore.getState().setSelectedStage("negotiation");
      useUiStore.getState().setManagersFilter(managers);
      useUiStore.getState().toggleManagerFilter("mgr-3");
      useUiStore.getState().toggleManagerFilter("mgr-1");

      const { filters } = useUiStore.getState();

      expect(filters.stage).toBe("negotiation");
      expect(filters.managers).toEqual(["mgr-2", "mgr-3"]);
      expect(managers).toEqual(["mgr-1", "mgr-2"]);
    });

    it("сбрасывает фильтры и выделение", () => {
      useUiStore.getState().setSelectedStage("proposal");
      useUiStore.getState().selectDeals(["deal-1", "deal-2"]);

      useUiStore.getState().clearFilters();

      const state = useUiStore.getState();
      expect(state.filters).toEqual({
        stage: "all",
        managers: [],
        period: "30d",
        search: "",
      });
      expect(state.selectedDealIds).toEqual([]);
    });
  });

  describe("deal selection", () => {
    it("переключает выделение сделок", () => {
      useUiStore.getState().toggleDealSelection("deal-1");
      useUiStore.getState().toggleDealSelection("deal-2");

      expect(useUiStore.getState().selectedDealIds).toEqual(["deal-1", "deal-2"]);

      useUiStore.getState().toggleDealSelection("deal-1");

      expect(useUiStore.getState().selectedDealIds).toEqual(["deal-2"]);
    });

    it("массово выделяет сделки и очищает выбор", () => {
      useUiStore.getState().selectDeals(["deal-1", "deal-2"]);
      useUiStore.getState().selectDeals(["deal-2", "deal-3"]);

      expect(useUiStore.getState().selectedDealIds).toEqual(["deal-1", "deal-2", "deal-3"]);

      useUiStore.getState().clearSelection();

      expect(useUiStore.getState().selectedDealIds).toEqual([]);
    });
  });

  describe("preview and hints", () => {
    it("открывает и закрывает предпросмотр сделки", () => {
      useUiStore.getState().openDealPreview("deal-42");

      expect(useUiStore.getState().previewDealId).toBe("deal-42");

      useUiStore.getState().openDealPreview(undefined);

      expect(useUiStore.getState().previewDealId).toBeUndefined();
    });

    it("помечает подсказку как просмотренную", () => {
      expect(useUiStore.getState().isHintDismissed("hint-1")).toBe(false);

      useUiStore.getState().dismissHint("hint-1");

      expect(useUiStore.getState().isHintDismissed("hint-1")).toBe(true);
    });
  });

  describe("handlePaymentEvent", () => {
    it("добавляет уведомление и запрашивает обновление таблицы для payment.created", () => {
      const event: PaymentEventPayload = {
        id: "event-1",
        type: "payments.payment.created",
        data: {
          payment_id: "pay-1",
          deal_id: "deal-1",
          amount: 12000,
          currency: "RUB",
          planned_date: "2024-04-01",
        },
      };

      const effect = useUiStore.getState().handlePaymentEvent(event);

      expect(effect.shouldRefetch).toBe(true);
      expect(effect.highlightDealId).toBe("deal-1");
      const notification = useUiStore.getState().notifications[0];
      expect(notification?.source).toBe("payments");
      expect(notification?.message).toContain("Создан новый платёж");
    });

    it("игнорирует heartbeat события без payload", () => {
      const event: PaymentEventPayload = {
        event: "heartbeat",
      };

      const effect = useUiStore.getState().handlePaymentEvent(event);

      expect(effect.shouldRefetch).toBe(false);
      expect(useUiStore.getState().notifications).toHaveLength(0);
    });
  });
});
