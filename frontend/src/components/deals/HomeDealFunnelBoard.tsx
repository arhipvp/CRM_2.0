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

function areArraysEqual<T>(a: readonly T[], b: readonly T[]) {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
}

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
      const postClearState = clearedState.current;

      if (!postClearState) {
        useUiStore.setState({ filters, selectedDealIds, previewDealId, highlightedDealId });
        return;
      }

      const currentState = useUiStore.getState();

      const patch: Partial<ReturnType<typeof useUiStore.getState>> = {};

      const shouldRestoreFilters = areDealFiltersEqual(currentState.filters, postClearState.filters);
      const shouldRestoreSelectedDeals = areArraysEqual(
        currentState.selectedDealIds,
        postClearState.selectedDealIds,
      );
      const shouldRestorePreview = currentState.previewDealId === postClearState.previewDealId;
      const shouldRestoreHighlight = currentState.highlightedDealId === postClearState.highlightedDealId;

      if (shouldRestoreFilters) {
        patch.filters = filters;
      }

      if (shouldRestoreSelectedDeals) {
        patch.selectedDealIds = selectedDealIds;
      }

      if (shouldRestorePreview) {
        patch.previewDealId = previewDealId;
      }

      if (shouldRestoreHighlight) {
        patch.highlightedDealId = highlightedDealId;
      }

      if (Object.keys(patch).length > 0) {
        useUiStore.setState(patch);
      }
    };
  }, []);

  if (!isReady) {
    return null;
  }

  return <DealFunnelBoard forceViewMode={forceViewMode} />;
}
