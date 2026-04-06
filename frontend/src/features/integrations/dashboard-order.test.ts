import { describe, expect, it } from "vitest";
import { normalizeDashboardCardOrder, reorderDashboardCardOrder } from "@/features/integrations/dashboard-order";
import type { TrackerIntegration } from "@/features/integrations/types";

function createTracker(id: string): TrackerIntegration {
  return {
    id,
    pluginId: id,
    dashboard: null,
    byteUnitSystem: "binary",
    name: id,
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

describe("dashboard card ordering helpers", () => {
  it("keeps known ids first and appends new integrations", () => {
    const integrations = [createTracker("alpha"), createTracker("beta"), createTracker("gamma")];

    expect(normalizeDashboardCardOrder(integrations, ["beta", "missing"])).toEqual(["beta", "alpha", "gamma"]);
  });

  it("moves the dragged card after the drop target", () => {
    expect(reorderDashboardCardOrder(["alpha", "beta", "gamma"], "alpha", "gamma")).toEqual(["beta", "gamma", "alpha"]);
  });

  it("moves a card onto a target to its left", () => {
    expect(reorderDashboardCardOrder(["alpha", "beta", "gamma"], "gamma", "alpha")).toEqual(["gamma", "alpha", "beta"]);
  });
});
