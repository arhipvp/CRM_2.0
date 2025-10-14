"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { DealFunnelBoard } from "@/components/deals/DealFunnelBoard";
import {
  DEFAULT_DEAL_FILTERS,
  areDealFiltersEqual,
  type DealFiltersState,
} from "@/lib/utils/dealFilters";
import { DealViewMode, useUiStore } from "@/stores/uiStore";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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
  const clearedState = useRef<SavedUiState>();
  const [isReady, setIsReady] = useState(() => {
    const state = useUiStore.getState();

    return (
      areDealFiltersEqual(state.filters, DEFAULT_DEAL_FILTERS) &&
      state.selectedDealIds.length === 0 &&
      !state.previewDealId &&
      !state.highlightedDealId
    );
  });

  useIsomorphicLayoutEffect(() => {
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

    const stateAfterReset = useUiStore.getState();

    clearedState.current = {
      filters: {
        ...stateAfterReset.filters,
        managers: [...stateAfterReset.filters.managers],
      },
      selectedDealIds: [...stateAfterReset.selectedDealIds],
      previewDealId: stateAfterReset.previewDealId,
      highlightedDealId: stateAfterReset.highlightedDealId,
    };

    if (!isReady) {
      setIsReady(true);
    }

    return () => {
      if (!savedState.current) {
        return;
      }

      const { filters, selectedDealIds, previewDealId, highlightedDealId } = savedState.current;
      const currentState = useUiStore.getState();
      const postClearState = clearedState.current;

      const shouldRestorePreview =
        postClearState && currentState.previewDealId === postClearState.previewDealId;
      const shouldRestoreHighlight =
        postClearState && currentState.highlightedDealId === postClearState.highlightedDealId;

      useUiStore.setState({
        filters,
        selectedDealIds,
        previewDealId: shouldRestorePreview ? previewDealId : currentState.previewDealId,
        highlightedDealId: shouldRestoreHighlight ? highlightedDealId : currentState.highlightedDealId,
      });
    };
  }, []);

  if (!isReady) {
    return null;
  }

  return <DealFunnelBoard forceViewMode={forceViewMode} />;
}
