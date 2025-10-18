import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

import { DealPreviewSidebar } from "@/components/deals/DealPreviewSidebar";
import { useUiStore } from "@/stores/uiStore";

const useDealsMock = vi.fn();

vi.mock("@/components/deals/DealDetails", () => ({
  DealDetails: () => null,
}));

vi.mock("@/lib/api/hooks", () => ({
  useDeals: (...args: unknown[]) => useDealsMock(...args),
}));

describe("DealPreviewSidebar", () => {
  const initialState = useUiStore.getState();

  beforeEach(() => {
    useDealsMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    useUiStore.setState(initialState, true);
  });

  afterEach(() => {
    useDealsMock.mockReset();
  });

  it("закрывает предпросмотр по нажатию Escape и снимает обработчик после размонтирования", () => {
    useUiStore.setState({ previewDealId: "deal-1" });

    const openDealPreviewSpy = vi.spyOn(useUiStore.getState(), "openDealPreview");

    const { unmount } = render(<DealPreviewSidebar />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(openDealPreviewSpy).toHaveBeenCalledWith(undefined);

    openDealPreviewSpy.mockClear();

    unmount();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(openDealPreviewSpy).not.toHaveBeenCalled();

    openDealPreviewSpy.mockRestore();
  });

  it("уважает отмену события другими обработчиками", () => {
    useUiStore.setState({ previewDealId: "deal-2" });

    const openDealPreviewSpy = vi.spyOn(useUiStore.getState(), "openDealPreview");

    render(<DealPreviewSidebar />);

    act(() => {
      const event = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
      event.preventDefault();
      window.dispatchEvent(event);
    });

    expect(openDealPreviewSpy).not.toHaveBeenCalled();

    openDealPreviewSpy.mockRestore();
  });
});
