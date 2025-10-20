import type { ComponentProps } from "react";

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MainNavigation } from "../MainNavigation";

const mockUsePathname = vi.hoisted(() => vi.fn<() => string>());

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}));

type AnchorProps = ComponentProps<"a">;

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...rest }: AnchorProps) => <a {...rest}>{children}</a>,
}));

describe("MainNavigation", () => {
  beforeEach(() => {
    mockUsePathname.mockReset();
  });

  it("отображает все основные ссылки", () => {
    mockUsePathname.mockReturnValue("/");

    render(<MainNavigation />);

    const expectedLinks = [
      { name: "Главная", href: "/" },
      { name: "Сделки", href: "/deals" },
      { name: "Клиенты", href: "/clients" },
      { name: "Задачи", href: "/tasks" },
      { name: "Платежи", href: "/payments" },
      { name: "Полисы", href: "/policies" },
      { name: "Уведомления", href: "/notifications" },
      { name: "Администрирование", href: "/admin" },
    ];

    expectedLinks.forEach(({ name, href }) => {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    });

    expect(screen.getAllByRole("link")).toHaveLength(expectedLinks.length);
  });

  it("подсвечивает активный маршрут", () => {
    mockUsePathname.mockReturnValue("/deals/open");

    render(<MainNavigation />);

    expect(screen.getByRole("link", { name: "Сделки" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Главная" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Полисы" })).not.toHaveAttribute("aria-current");
  });
});
