import type { Deal, DealStage } from "@/types/crm";

export const DEAL_STAGE_TITLES: Record<DealStage, string> = {
  qualification: "Квалификация",
  negotiation: "Переговоры",
  proposal: "Коммерческое предложение",
  closedWon: "Успешно",
  closedLost: "Потеряно",
};

export function getDealStageTitle(stage: DealStage | null | undefined): string {
  if (!stage) {
    return "Неизвестная стадия";
  }

  return DEAL_STAGE_TITLES[stage] ?? "Неизвестная стадия";
}

function toFiniteTimestamp(value?: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function compareTimestamps(a?: string, b?: string): number {
  const aValue = toFiniteTimestamp(a);
  const bValue = toFiniteTimestamp(b);

  if (aValue === null && bValue === null) {
    return 0;
  }

  if (aValue === null) {
    return 1;
  }

  if (bValue === null) {
    return -1;
  }

  return aValue - bValue;
}

export function safeTimestamp(value?: string): number | null {
  return toFiniteTimestamp(value);
}

export type DealLike = Pick<Deal, "nextReviewAt" | "updatedAt"> & Partial<Pick<Deal, "name" | "id">>;

export function compareDealsByNextReview<T extends DealLike>(a: T, b: T): number {
  const nextReviewDiff = compareTimestamps(a.nextReviewAt, b.nextReviewAt);
  if (nextReviewDiff !== 0) {
    return nextReviewDiff;
  }

  const updatedDiff = compareTimestamps(a.updatedAt, b.updatedAt);
  if (updatedDiff !== 0) {
    return updatedDiff;
  }

  if (a.name && b.name) {
    const labelDiff = a.name.localeCompare(b.name, "ru");
    if (labelDiff !== 0) {
      return labelDiff;
    }
  }

  if (a.id && b.id) {
    return a.id.localeCompare(b.id, "ru");
  }

  return 0;
}

export function sortDealsByNextReview<T extends DealLike>(deals: readonly T[]): T[] {
  return [...deals].sort(compareDealsByNextReview);
}
