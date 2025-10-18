"use client";

import { useMemo, useState } from "react";

import { HomeFiltersPanel } from "@/components/home/HomeFiltersPanel";
import { HomeStageMetricsPanel } from "@/components/home/HomeStageMetricsPanel";
import type { HomeComparisonMode, HomeFunnelKey } from "@/components/home/types";
import type { DealFiltersState } from "@/lib/utils/dealFilters";
import { createDefaultDealFilters } from "@/lib/utils/dealFilters";

interface HomeOverviewProps {
  defaultFilters?: DealFiltersState;
}

export function HomeOverview({ defaultFilters }: HomeOverviewProps) {
  const initialFilters = useMemo(() => {
    const base = defaultFilters ?? createDefaultDealFilters();
    return {
      ...base,
      managers: [...base.managers],
    } satisfies DealFiltersState;
  }, [defaultFilters]);

  const [dealFilters, setDealFilters] = useState<DealFiltersState>(initialFilters);
  const [funnel, setFunnel] = useState<HomeFunnelKey>("main");
  const [comparisonMode, setComparisonMode] = useState<HomeComparisonMode>("previousPeriod");

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <HomeFiltersPanel
        filters={dealFilters}
        onFiltersChange={setDealFilters}
        selectedFunnel={funnel}
        onFunnelChange={setFunnel}
        comparisonMode={comparisonMode}
        onComparisonModeChange={setComparisonMode}
      />
      <HomeStageMetricsPanel
        filters={dealFilters}
        selectedFunnel={funnel}
        comparisonMode={comparisonMode}
      />
    </section>
  );
}
