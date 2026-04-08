import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DASHBOARD_CARD_ORDER_STORAGE_KEY, useDashboardCardOrder } from "@/features/integrations/dashboard-order";
import type { TrackerIntegration } from "@/features/integrations/types";

function createTracker(id: string, name: string): TrackerIntegration {
  return {
    id,
    pluginId: id,
    dashboard: null,
    byteUnitSystem: "binary",
    name,
    payload: {},
    url: null,
    ratio: null,
    uploaded: null,
    downloaded: null,
    seedBonus: null,
    buffer: null,
    hitAndRuns: null,
    requiredRatio: null,
    seedingTorrents: null,
    leechingTorrents: null,
    activeTorrents: null,
    lastSync: null,
    lastSyncExact: null,
    nextAutomaticSync: null,
    nextAutomaticSyncExact: null,
    status: "pending",
    statusLabel: "never synced",
    configurationValid: true,
    configurationError: null,
  };
}

describe("useDashboardCardOrder", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("preserves stored order through the initial empty loading state", () => {
    window.localStorage.setItem(DASHBOARD_CARD_ORDER_STORAGE_KEY, JSON.stringify(["beta", 123, "alpha"]));

    const { result, rerender } = renderHook(
      ({ integrations }) => useDashboardCardOrder(integrations),
      { initialProps: { integrations: [] as TrackerIntegration[] } },
    );

    expect(result.current.orderedIntegrations).toEqual([]);

    rerender({
      integrations: [
        createTracker("alpha", "Alpha"),
        createTracker("beta", "Beta"),
      ],
    });

    expect(result.current.orderedIntegrations.map((integration) => integration.id)).toEqual(["beta", "alpha"]);
    expect(window.localStorage.getItem(DASHBOARD_CARD_ORDER_STORAGE_KEY)).toBe(JSON.stringify(["beta", "alpha"]));
  });

  it("ignores malformed stored order shapes that are not arrays", () => {
    window.localStorage.setItem(DASHBOARD_CARD_ORDER_STORAGE_KEY, JSON.stringify({ order: ["beta"] }));

    const { result } = renderHook(() =>
      useDashboardCardOrder([
        createTracker("alpha", "Alpha"),
        createTracker("beta", "Beta"),
      ]),
    );

    expect(result.current.orderedIntegrations.map((integration) => integration.id)).toEqual(["alpha", "beta"]);
  });

  it("handles invalid stored JSON and drag/drop boundary branches", () => {
    window.localStorage.setItem(DASHBOARD_CARD_ORDER_STORAGE_KEY, "{broken");

    const { result } = renderHook(() =>
      useDashboardCardOrder([
        createTracker("alpha", "Alpha"),
        createTracker("beta", "Beta"),
        createTracker("gamma", "Gamma"),
      ]),
    );

    expect(result.current.orderedIntegrations.map((integration) => integration.id)).toEqual(["alpha", "beta", "gamma"]);

    const preventDefault = vi.fn();
    const dataTransfer = {
      dropEffect: "",
      getData: vi.fn(() => "alpha"),
    } as unknown as DataTransfer;

    act(() => {
      result.current.handleCardDragStart("alpha");
      result.current.handleCardDragOver({ preventDefault, dataTransfer } as unknown, "beta", "after");
      result.current.handleCardDrop("beta", "alpha", "after");
    });
    expect(result.current.orderedIntegrations.map((integration) => integration.id)).toEqual(["beta", "alpha", "gamma"]);

    // No-op drop cases.
    act(() => {
      result.current.handleCardDrop("beta", "beta", "before");
      result.current.handleCardDrop("beta", undefined, "before");
    });

    act(() => {
      result.current.handleCardDragEnd();
    });
    expect(result.current.draggedCardId).toBeNull();
    expect(result.current.dropTargetCardId).toBeNull();
    expect(result.current.dropTargetSide).toBeNull();
  });

  it("does not set a drop target when drag-over has no active drag or same target", () => {
    const { result } = renderHook(() =>
      useDashboardCardOrder([
        createTracker("alpha", "Alpha"),
        createTracker("beta", "Beta"),
      ]),
    );

    const preventDefault = vi.fn();
    const dataTransfer = { dropEffect: "" } as unknown as DataTransfer;

    act(() => {
      result.current.handleCardDragOver({ preventDefault, dataTransfer } as unknown, "alpha", "before");
    });
    expect(result.current.dropTargetCardId).toBeNull();
    expect(result.current.dropTargetSide).toBeNull();

    act(() => {
      result.current.handleCardDragStart("alpha");
    });
    act(() => {
      result.current.handleCardDragOver({ preventDefault, dataTransfer } as unknown, "alpha", "before");
    });
    expect(result.current.dropTargetCardId).toBeNull();

    act(() => {
      result.current.handleCardDragOver({ preventDefault, dataTransfer } as unknown, "beta", "before");
    });
    expect(result.current.dropTargetCardId).toBe("beta");
    expect(result.current.dropTargetSide).toBe("before");

    act(() => {
      result.current.handleCardDragOver({ preventDefault, dataTransfer } as unknown, "beta", "after");
    });
    expect(result.current.dropTargetSide).toBe("after");
  });

  it("swallows localStorage write errors without crashing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const { result } = renderHook(() =>
      useDashboardCardOrder([createTracker("alpha", "Alpha"), createTracker("beta", "Beta")]),
    );

    act(() => {
      result.current.handleCardDrop("beta", "alpha", "after");
    });

    return waitFor(() => {
      expect(warnSpy).toHaveBeenCalled();
      expect(setItemSpy).toHaveBeenCalled();
    }).finally(() => {
      setItemSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });
});
