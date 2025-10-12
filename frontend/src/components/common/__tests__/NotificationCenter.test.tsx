import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationCenter } from "../NotificationCenter";

const dismissNotificationMock = vi.fn();

const notifications = [
  {
    id: "1",
    message: "Платёж подтверждён",
    type: "success" as const,
    timestamp: new Date("2024-01-01T10:00:00.000Z").toISOString(),
    source: "payments" as const,
  },
];

vi.mock("@/stores/uiStore", () => ({
  __esModule: true,
  useUiStore: (selector: (state: unknown) => unknown) =>
    selector({
      notifications,
      dismissNotification: dismissNotificationMock,
    }),
}));

describe("NotificationCenter", () => {
  beforeEach(() => {
    dismissNotificationMock.mockClear();
  });

  it("отображает корректный заголовок для уведомлений из платежей", () => {
    render(<NotificationCenter />);

    expect(screen.getByText("Платежи")).toBeInTheDocument();
    expect(screen.getByText("Платёж подтверждён")).toBeInTheDocument();
  });
});
