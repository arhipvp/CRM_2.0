import { afterEach, describe, expect, it } from "vitest";

import { PaymentEventPayload, useUiStore } from "@/stores/uiStore";

const initialState = useUiStore.getState();

afterEach(() => {
  useUiStore.setState(initialState, true);
});

describe("useUiStore", () => {
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
