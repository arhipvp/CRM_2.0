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
