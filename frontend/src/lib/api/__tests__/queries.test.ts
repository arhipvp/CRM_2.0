import { describe, expect, it } from "vitest";

import {
  clientActivityQueryOptions,
  clientPoliciesQueryOptions,
  dealsQueryOptions,
} from "@/lib/api/queries";
import { createDefaultDealFilters } from "@/lib/utils/dealFilters";

describe("dealsQueryOptions", () => {
  it("использует те же значения фильтров по умолчанию для формирования ключа запроса", () => {
    const defaultFilters = createDefaultDealFilters();

    const queryKey = dealsQueryOptions(defaultFilters).queryKey;

    expect(queryKey).toEqual([
      "deals",
      {
        period: defaultFilters.period,
      },
    ]);
  });
});

describe("clientActivityQueryOptions", () => {
  it("нормализует параметры активности", () => {
    const options = clientActivityQueryOptions("client-1", { type: "email", page: 2, pageSize: 10 });
    expect(options.queryKey).toEqual([
      "client",
      "client-1",
      "activity",
      { type: "email", page: 2, pageSize: 10 },
    ]);
  });
});

describe("clientPoliciesQueryOptions", () => {
  it("очищает параметры фильтрации полисов", () => {
    const options = clientPoliciesQueryOptions("client-1", { status: "archived", search: "  КАСКО " });
    expect(options.queryKey).toEqual([
      "client",
      "client-1",
      "policies",
      { status: "archived", search: "КАСКО" },
    ]);
  });
});
