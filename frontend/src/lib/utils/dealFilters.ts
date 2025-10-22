import type { DealFilters } from "@/types/crm";

export type DealFiltersState = Required<Pick<DealFilters, "stage" | "managers" | "period" | "search">>;

const defaultDealFilters: DealFiltersState = {
  stage: "all",
  managers: [],
  period: "30d",
  search: "",
};

export const DEFAULT_DEAL_FILTERS: DealFiltersState = {
  ...defaultDealFilters,
};

export const createDefaultDealFilters = (): DealFiltersState => ({
  ...DEFAULT_DEAL_FILTERS,
  managers: [...DEFAULT_DEAL_FILTERS.managers],
});

export function areDealFiltersEqual(left: DealFiltersState, right: DealFiltersState): boolean {
  if (left.stage !== right.stage) {
    return false;
  }

  if (left.period !== right.period) {
    return false;
  }

  if (left.search !== right.search) {
    return false;
  }

  if (left.managers.length !== right.managers.length) {
    return false;
  }

  return left.managers.every((value, index) => value === right.managers[index]);
}
