import type { DealDocumentV2, DealDocumentVersionInfo } from "@/types/crm";

export interface UploadDealDocumentOptions {
  dealId: string;
  file: File;
  onProgress?: (value: number) => void;
  signal?: AbortSignal;
}

export interface ChangeDocumentCategoryOptions {
  documentId: string;
  categoryId: string;
}

const uploadDelayStep = 160;
const uploadMinSteps = 8;
const uploadMaxSteps = 18;

function createDocumentFromFile(file: File): DealDocumentV2 {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const uploadedAt = new Date().toISOString();
  const extension = file.name.split(".").pop()?.toUpperCase() ?? "FILE";

  const baseVersion: DealDocumentVersionInfo = {
    id: `${id}-v1`,
    version: 1,
    uploadedAt,
    uploadedBy: "Вы",
    size: file.size,
  };

  return {
    id,
    name: file.name,
    type: extension,
    size: file.size,
    category: "",
    uploadedAt,
    uploadedBy: "Вы",
    reviewStatus: "pending",
    versions: [baseVersion],
    url: `https://files.crm.local/${id}`,
  };
}

export async function uploadDealDocument({
  dealId,
  file,
  onProgress,
  signal,
}: UploadDealDocumentOptions): Promise<DealDocumentV2> {
  if (!dealId) {
    throw new Error("dealId is required for document upload");
  }

  if (signal?.aborted) {
    throw new DOMException("Upload aborted", "AbortError");
  }

  return new Promise<DealDocumentV2>((resolve, reject) => {
    const controller = new AbortController();
    const steps = Math.max(uploadMinSteps, Math.min(uploadMaxSteps, Math.ceil(file.size / (1024 * 200))));
    let currentStep = 0;

    const cleanup = () => {
      controller.abort();
    };

    const emitProgress = (value: number) => {
      onProgress?.(value);
    };

    const tick = () => {
      if (signal?.aborted) {
        cleanup();
        reject(new DOMException("Upload aborted", "AbortError"));
        return;
      }

      currentStep += 1;
      const progress = Math.min(100, Math.round((currentStep / steps) * 100));
      emitProgress(progress);

      if (progress >= 100) {
        cleanup();
        resolve(createDocumentFromFile(file));
        return;
      }

      const timeout = uploadDelayStep + Math.random() * uploadDelayStep;
      setTimeout(tick, timeout);
    };

    signal?.addEventListener(
      "abort",
      () => {
        cleanup();
        reject(new DOMException("Upload aborted", "AbortError"));
      },
      { once: true },
    );

    const initialTimeout = uploadDelayStep + Math.random() * uploadDelayStep;
    setTimeout(tick, initialTimeout);
  });
}

export async function changeDealDocumentCategory({ documentId, categoryId }: ChangeDocumentCategoryOptions): Promise<void> {
  if (!documentId || !categoryId) {
    throw new Error("Both documentId and categoryId are required");
  }

  return new Promise((resolve) => {
    setTimeout(resolve, 250);
  });
}

export const DOCUMENT_CATEGORY_PRESET = [
  { id: "agreement", title: "Договор" },
  { id: "consents", title: "Согласия" },
  { id: "materials", title: "Дополнительные материалы" },
] as const;
