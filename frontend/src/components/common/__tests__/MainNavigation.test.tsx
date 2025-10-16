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

    expect(screen.getByRole("link", { name: "Главная" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Сделки" })).toHaveAttribute("href", "/deals");
    expect(screen.getByRole("link", { name: "Задачи" })).toHaveAttribute("href", "/tasks");
    expect(screen.getByRole("link", { name: "Платежи" })).toHaveAttribute("href", "/payments");
    expect(screen.getByRole("link", { name: "Полисы" })).toHaveAttribute("href", "/policies");
    expect(screen.getByRole("link", { name: "Уведомления" })).toHaveAttribute("href", "/notifications");
    expect(screen.getByRole("link", { name: "Администрирование" })).toHaveAttribute("href", "/admin");
  });

  it("подсвечивает активный маршрут", () => {
    mockUsePathname.mockReturnValue("/deals/open");

    render(<MainNavigation />);

    expect(screen.getByRole("link", { name: "Сделки" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Главная" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Полисы" })).not.toHaveAttribute("aria-current");
  });
});
