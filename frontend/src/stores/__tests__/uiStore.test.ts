import { afterEach, describe, expect, it } from "vitest";

import { PaymentEventPayload, useUiStore } from "@/stores/uiStore";
import { NO_MANAGER_VALUE } from "@/lib/utils/managers";

const initialState = useUiStore.getState();

afterEach(() => {
  useUiStore.setState(initialState, true);
});

describe("useUiStore", () => {
  describe("ui filters", () => {
    it("обновляет фильтры и нормализует менеджеров", () => {
      const managers = [" mgr-1 ", "mgr-2", "mgr-2", NO_MANAGER_VALUE];

      useUiStore.getState().setSelectedStage("negotiation");
      useUiStore.getState().setManagersFilter(managers);

      expect(useUiStore.getState().filters.managers).toEqual(["mgr-1", "mgr-2", NO_MANAGER_VALUE]);

      useUiStore.getState().toggleManagerFilter("mgr-3");
      expect(useUiStore.getState().filters.managers).toEqual([
        "mgr-1",
        "mgr-2",
        NO_MANAGER_VALUE,
        "mgr-3",
      ]);

      useUiStore.getState().toggleManagerFilter(" mgr-1 ");
      expect(useUiStore.getState().filters.managers).toEqual(["mgr-2", NO_MANAGER_VALUE, "mgr-3"]);

      useUiStore.getState().toggleManagerFilter(NO_MANAGER_VALUE);
      expect(useUiStore.getState().filters.managers).toEqual(["mgr-2", "mgr-3"]);

      useUiStore.getState().toggleManagerFilter(NO_MANAGER_VALUE);
      expect(useUiStore.getState().filters.managers).toEqual(["mgr-2", "mgr-3", NO_MANAGER_VALUE]);

      useUiStore.getState().setPeriodFilter("7d");
      useUiStore.getState().setSearchFilter("Страхование");

      const { filters } = useUiStore.getState();

      expect(filters.stage).toBe("negotiation");
      expect(filters.managers).toEqual(["mgr-2", "mgr-3", NO_MANAGER_VALUE]);
      expect(filters.period).toBe("7d");
      expect(filters.search).toBe("Страхование");
      expect(managers).toEqual([" mgr-1 ", "mgr-2", "mgr-2", NO_MANAGER_VALUE]);
    });

    it("сбрасывает фильтры", () => {
      useUiStore.getState().setSelectedStage("proposal");

      useUiStore.getState().clearFilters();

      const state = useUiStore.getState();
      expect(state.filters).toEqual({
        stage: "all",
        managers: [],
        period: "30d",
        search: "",
      });
      expect(state.filters).not.toBe(initialState.filters);
    });
  });

  describe("preview", () => {
    it("открывает и закрывает предпросмотр сделки", () => {
      useUiStore.getState().openDealPreview("deal-42");

      expect(useUiStore.getState().previewDealId).toBe("deal-42");

      useUiStore.getState().openDealPreview(undefined);

      expect(useUiStore.getState().previewDealId).toBeUndefined();
    });
  });

  describe("deal updates", () => {
    it("добавляет и очищает отметку обновлённой сделки", () => {
      useUiStore.getState().markDealUpdated("deal-1");
      expect(useUiStore.getState().dealUpdates["deal-1"]).toBeDefined();

      useUiStore.getState().clearDealUpdate("deal-1");
      expect(useUiStore.getState().dealUpdates["deal-1"]).toBeUndefined();
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

  describe("deal details helpers", () => {
    it("переключает активную вкладку деталей", () => {
      expect(useUiStore.getState().dealDetailsTab).toBe("overview");

      useUiStore.getState().setDealDetailsTab("documents");

      expect(useUiStore.getState().dealDetailsTab).toBe("documents");

      useUiStore.getState().setDealDetailsTab("calculations");

      expect(useUiStore.getState().dealDetailsTab).toBe("calculations");
    });

    it("создаёт и поглощает запросы действий", () => {
      useUiStore.getState().triggerDealDetailsRequest("task");

      const afterTrigger = useUiStore.getState();
      expect(afterTrigger.dealDetailsTab).toBe("tasks");
      expect(afterTrigger.dealDetailsRequests.task).toBeTruthy();

      const requestId = afterTrigger.dealDetailsRequests.task;
      useUiStore.getState().consumeDealDetailsRequest("task");

      expect(useUiStore.getState().dealDetailsRequests.task).toBeUndefined();

      // Повторный вызов не должен менять состояние
      useUiStore.getState().consumeDealDetailsRequest("task");
      expect(useUiStore.getState().dealDetailsRequests.task).toBeUndefined();

      // Проверяем другие типы
      useUiStore.getState().triggerDealDetailsRequest("document");
      expect(useUiStore.getState().dealDetailsTab).toBe("documents");
      expect(useUiStore.getState().dealDetailsRequests.document).not.toBe(requestId);
    });
  });
});
