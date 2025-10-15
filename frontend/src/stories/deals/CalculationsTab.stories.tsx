import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CalculationsTab } from "@/components/deals/details/CalculationsTab";
import type { DealCalculation } from "@/types/crm";

const readyCalculation: DealCalculation = {
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
};

const meta: Meta<typeof CalculationsTab> = {
  title: "Deals/CalculationsTab",
  component: CalculationsTab,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    calculations: [readyCalculation],
  },
};

export default meta;

type Story = StoryObj<typeof CalculationsTab>;

export const ReadyAwaitingConfirmation: Story = {
  name: "Строка расчёта в статусе ready",
  args: {
    calculations: [readyCalculation],
  },
};
