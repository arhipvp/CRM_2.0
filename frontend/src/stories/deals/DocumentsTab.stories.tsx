import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import React from "react";

import { DocumentsTab } from "@/components/deals/details/DocumentsTab";
import { dealDetailsMock } from "@/mocks/data";
import type { DealDocumentCategory } from "@/types/crm";

const deal = dealDetailsMock["deal-1"];
const baseCategories: DealDocumentCategory[] = deal.documentsV2;

const meta: Meta<typeof DocumentsTab> = {
  title: "Deals/DocumentsTab",
  component: DocumentsTab,
  parameters: {
    layout: "centered",
  },
  args: {
    dealId: "deal-1",
    categories: baseCategories,
  },
};

export default meta;

type Story = StoryObj<typeof DocumentsTab>;

export const Default: Story = {
  render: (args) => <DocumentsTab {...args} />,
};

export const UploadQueue: Story = {
  render: (args) => <DocumentsTab {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText<HTMLInputElement>("Загрузить документы");
    const user = userEvent.setup();
    const file = new File(["demo"], "договор.pdf", { type: "application/pdf" });

    await user.upload(input, file);

    await waitFor(() => {
      expect(canvas.getByText("договор.pdf")).toBeInTheDocument();
    });
  },
};

export const MissingDealIdError: Story = {
  render: (args) => <DocumentsTab {...args} dealId={undefined} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText<HTMLInputElement>("Загрузить документы");
    const user = userEvent.setup();
    const file = new File(["demo"], "ошибка.pdf", { type: "application/pdf" });

    await user.upload(input, file);

    await waitFor(() => {
      expect(canvas.getByText(/Не указан идентификатор сделки/i)).toBeInTheDocument();
    });
  },
};

export const ChangeCategory: Story = {
  render: (args) => <DocumentsTab {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const menuTrigger = canvas.getAllByRole("button", { name: "⋯" })[0];
    const user = userEvent.setup();

    await user.click(menuTrigger);
    const changeButton = await canvas.findByRole("button", { name: "Изменить категорию" });
    await user.click(changeButton);

    const option = await canvas.findByLabelText("Дополнительные материалы");
    await user.click(option);

    const save = await canvas.findByRole("button", { name: "Сохранить" });
    await user.click(save);
  },
};
