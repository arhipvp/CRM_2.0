import type { ComponentProps } from "react";

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MainNavigation } from "../MainNavigation";

const mockUsePathname = vi.hoisted(() => vi.fn<() => string>());
const mockUseAuthStore = vi.hoisted(() => vi.fn<() => any>());

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: mockUseAuthStore,
}));

type AnchorProps = ComponentProps<"a">;

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...rest }: AnchorProps) => <a {...rest}>{children}</a>,
}));

describe("MainNavigation", () => {
  beforeEach(() => {
    mockUsePathname.mockReset();
    mockUseAuthStore.mockReset();
    // Mock authenticated user
    mockUseAuthStore.mockReturnValue({
      status: "authenticated",
      user: {
        id: "test-user",
        email: "test@example.com",
        enabled: true,
        roles: [],
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      },
    });
  });

  it("отображает все основные ссылки на рабочем столе", () => {
    mockUsePathname.mockReturnValue("/");

    render(<MainNavigation />);

    const expectedLinks = [
      "Главная",
      "Сделки",
      "Клиенты",
      "Задачи",
      "Платежи",
      "Полисы",
      "Уведомления",
      "Администрирование",
    ];

    expectedLinks.forEach((name) => {
      const link = screen.getByRole("link", { name });
      expect(link).toBeInTheDocument();
    });
  });

  it("подсвечивает активный маршрут", () => {
    mockUsePathname.mockReturnValue("/deals/open");

    render(<MainNavigation />);

    const dealsLink = screen.getByRole("link", { name: "Сделки" });
    expect(dealsLink).toHaveAttribute("aria-current", "page");

    const homeLink = screen.getByRole("link", { name: "Главная" });
    expect(homeLink).not.toHaveAttribute("aria-current");
  });

  it("скрывает навигацию, если пользователь не аутентифицирован", () => {
    mockUseAuthStore.mockReturnValue({
      status: "idle",
      user: null,
    });

    render(<MainNavigation />);

    // Should not render any links
    expect(screen.queryByRole("link", { name: "Главная" })).not.toBeInTheDocument();
  });
});
