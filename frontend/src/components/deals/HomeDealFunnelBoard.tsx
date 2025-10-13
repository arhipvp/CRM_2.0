"use client";

import { useEffect, useRef } from "react";

import { DealFunnelBoard } from "@/components/deals/DealFunnelBoard";
import { type DealFiltersState } from "@/lib/utils/dealFilters";
import { DealViewMode, useUiStore } from "@/stores/uiStore";

type SavedUiState = {
  filters: DealFiltersState;
  selectedDealIds: string[];
  previewDealId?: string;
  highlightedDealId?: string;
};

type HomeDealFunnelBoardProps = {
  forceViewMode?: DealViewMode;
};

export function HomeDealFunnelBoard({ forceViewMode }: HomeDealFunnelBoardProps) {
  const savedState = useRef<SavedUiState>();

  useEffect(() => {
    const store = useUiStore.getState();

    savedState.current = {
      filters: {
        ...store.filters,
        managers: [...store.filters.managers],
      },
      selectedDealIds: [...store.selectedDealIds],
      previewDealId: store.previewDealId,
      highlightedDealId: store.highlightedDealId,
    };

    store.clearFilters();

    if (store.previewDealId) {
      store.openDealPreview(undefined);
    }

    if (store.highlightedDealId) {
      store.highlightDeal(undefined);
    }

    return () => {
      if (!savedState.current) {
        return;
      }

      const { filters, selectedDealIds, previewDealId, highlightedDealId } = savedState.current;

      useUiStore.setState({
        filters,
        selectedDealIds,
        previewDealId,
        highlightedDealId,
      });
    };
  }, []);

  return <DealFunnelBoard forceViewMode={forceViewMode} />;
}
