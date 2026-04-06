import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
    window.localStorage.setItem(DASHBOARD_CARD_ORDER_STORAGE_KEY, JSON.stringify(["beta", "alpha"]));

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
});
