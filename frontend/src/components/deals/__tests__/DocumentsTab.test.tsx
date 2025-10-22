import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { DocumentsTab } from "@/components/deals/details/DocumentsTab";
import { dealDetailsMock } from "@/mocks/data";
import type { DealDocumentCategory, DealDocumentV2 } from "@/types/crm";

const uploadDealDocumentMock = vi.fn();
const changeDealDocumentCategoryMock = vi.fn();

vi.mock("@/lib/api/documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/documents")>();
  return {
    ...actual,
    uploadDealDocument: (...args: Parameters<typeof actual.uploadDealDocument>) =>
      uploadDealDocumentMock(...args),
    changeDealDocumentCategory: (...args: Parameters<typeof actual.changeDealDocumentCategory>) =>
      changeDealDocumentCategoryMock(...args),
  };
});

function cloneCategories(): DealDocumentCategory[] {
  return dealDetailsMock["deal-1"].documentsV2.map((category) => ({
    ...category,
    documents: category.documents.map((document) => ({ ...document })),
  }));
}

describe("DocumentsTab", () => {
  beforeEach(() => {
    uploadDealDocumentMock.mockReset();
    changeDealDocumentCategoryMock.mockReset();
  });

  it("обрабатывает успешную загрузку и присвоение категории", async () => {
    const categories = cloneCategories().map((category) => ({ ...category, documents: [] }));
    const document: DealDocumentV2 = {
      id: "doc-new",
      name: "новый документ.pdf",
      type: "PDF",
      size: 1_024,
      category: "",
      uploadedAt: new Date().toISOString(),
      uploadedBy: "Вы",
      reviewStatus: "pending",
      versions: [
        {
          id: "doc-new-v1",
          version: 1,
          uploadedAt: new Date().toISOString(),
          uploadedBy: "Вы",
          size: 1_024,
        },
      ],
    };

    uploadDealDocumentMock.mockImplementation(async ({ onProgress }) => {
      onProgress?.(25);
      onProgress?.(100);
      return document;
    });
    changeDealDocumentCategoryMock.mockResolvedValue(undefined);

    render(<DocumentsTab dealId="deal-1" categories={categories} />);

    const input = screen.getByLabelText("Загрузить документы");
    await userEvent.upload(input, new File(["demo"], document.name, { type: "application/pdf" }));

    expect(uploadDealDocumentMock).toHaveBeenCalledOnce();
    expect(await screen.findByText(document.name)).toBeInTheDocument();
    expect(await screen.findByText(/Загружено, выберите категорию/)).toBeInTheDocument();

    const categoryOption = await screen.findByLabelText("Договор");
    await userEvent.click(categoryOption);

    const saveButton = await screen.findByRole("button", { name: "Сохранить" });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(changeDealDocumentCategoryMock).toHaveBeenCalledWith({
        documentId: document.id,
        categoryId: "agreement",
      });
    });

    await waitFor(() => {
      expect(screen.queryByText(/Загружено, выберите категорию/)).not.toBeInTheDocument();
    });

    const agreementSection = screen.getByRole("heading", { name: "Договор" }).closest("section");
    expect(agreementSection).not.toBeNull();
    if (agreementSection) {
      expect(within(agreementSection).getByText(document.name)).toBeInTheDocument();
    }
  });

  it("показывает ошибку при неудачной загрузке", async () => {
    const categories = cloneCategories().map((category) => ({ ...category, documents: [] }));

    uploadDealDocumentMock.mockRejectedValue(new Error("Ошибка загрузки"));

    render(<DocumentsTab dealId="deal-1" categories={categories} />);

    const input = screen.getByLabelText("Загрузить документы");
    await userEvent.upload(input, new File(["demo"], "ошибка.pdf", { type: "application/pdf" }));

    expect(uploadDealDocumentMock).toHaveBeenCalledOnce();
    expect(await screen.findByText(/Ошибка загрузки/)).toBeInTheDocument();
    expect(changeDealDocumentCategoryMock).not.toHaveBeenCalled();
  });

  it("позволяет изменить категорию существующего документа", async () => {
    const categories = cloneCategories();
    const target = categories.find((category) => category.documents.length > 0)?.documents[0];
    expect(target).toBeDefined();
    if (!target) {
      throw new Error("Test setup error: target document not found");
    }

    changeDealDocumentCategoryMock.mockResolvedValue(undefined);

    render(<DocumentsTab dealId="deal-1" categories={categories} />);

    const menuButton = screen.getAllByRole("button", { name: "⋯" })[0];
    await userEvent.click(menuButton);

    const changeButton = await screen.findByRole("button", { name: "Изменить категорию" });
    await userEvent.click(changeButton);

    const newCategory = await screen.findByLabelText("Дополнительные материалы");
    await userEvent.click(newCategory);

    await userEvent.click(await screen.findByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(changeDealDocumentCategoryMock).toHaveBeenCalledWith({
        documentId: target.id,
        categoryId: "materials",
      });
    });

    const materialsSection = screen.getByRole("heading", { name: "Дополнительные материалы" }).closest("section");
    expect(materialsSection).not.toBeNull();
    if (materialsSection) {
      await waitFor(() => {
        expect(within(materialsSection).getByText(target.name)).toBeInTheDocument();
      });
    }
  });
});
