import { describe, expect, it } from "vitest";

import { dealsQueryOptions } from "@/lib/api/queries";
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
