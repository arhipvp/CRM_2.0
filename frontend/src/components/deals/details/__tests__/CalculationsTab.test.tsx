import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import { CalculationsTab } from "@/components/deals/details/CalculationsTab";
import type { DealCalculation } from "@/types/crm";

describe("CalculationsTab", () => {
  test("отображает дополнительный бейдж для статуса ready", () => {
    const calculations: DealCalculation[] = [
      {
        id: "calc-ready",
        insurer: "АльфаСтрахование",
        program: "Корпоративное здоровье",
        premium: 450000,
        currency: "RUB",
        period: "01.01.2025 — 31.12.2025",
        status: "ready",
        updatedAt: new Date("2025-01-05T09:00:00Z").toISOString(),
        files: [],
        tags: [],
      },
    ];

    render(<CalculationsTab calculations={calculations} />);

    expect(screen.getByText("Готов")).toBeInTheDocument();
    expect(screen.getByText("Ожидает подтверждения")).toBeInTheDocument();
  });
});
