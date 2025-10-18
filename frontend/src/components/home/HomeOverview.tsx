"use client";

import { useMemo } from "react";

import { HomeQuickActions } from "@/components/home/HomeQuickActions";
import { HomeRecentDeals } from "@/components/home/HomeRecentDeals";
import type { DealFiltersState } from "@/lib/utils/dealFilters";
import { createDefaultDealFilters } from "@/lib/utils/dealFilters";

interface HomeOverviewProps {
  defaultFilters?: DealFiltersState;
}

export function HomeOverview({ defaultFilters }: HomeOverviewProps) {
  const filters = useMemo(() => {
    const base = defaultFilters ?? createDefaultDealFilters();
    return {
      ...base,
      managers: [...base.managers],
    } satisfies DealFiltersState;
  }, [defaultFilters]);

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <HomeQuickActions />
      <HomeRecentDeals filters={filters} />
    </section>
  );
}
