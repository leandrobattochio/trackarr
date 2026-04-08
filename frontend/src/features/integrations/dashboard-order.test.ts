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

  it("inserts dragged card before the drop target", () => {
    expect(reorderDashboardCardOrder(["alpha", "beta", "gamma"], "gamma", "alpha", "before")).toEqual(["gamma", "alpha", "beta"]);
  });

  it("inserts dragged card after the drop target", () => {
    expect(reorderDashboardCardOrder(["alpha", "beta", "gamma"], "alpha", "gamma", "after")).toEqual(["beta", "gamma", "alpha"]);
  });

  it("inserts card after an adjacent target correctly", () => {
    expect(reorderDashboardCardOrder(["alpha", "beta", "gamma"], "alpha", "beta", "after")).toEqual(["beta", "alpha", "gamma"]);
  });

  it("inserts card before an adjacent target correctly", () => {
    expect(reorderDashboardCardOrder(["alpha", "beta", "gamma"], "gamma", "beta", "before")).toEqual(["alpha", "gamma", "beta"]);
  });

  it("deduplicates stored order and appends missing ids in current integration order", () => {
    const integrations = [createTracker("alpha"), createTracker("beta"), createTracker("gamma")];

    expect(normalizeDashboardCardOrder(integrations, ["beta", "beta", "gamma", "unknown"])).toEqual([
      "beta",
      "gamma",
      "alpha",
    ]);
  });

  it("returns original order when dragged and target ids are invalid or equal", () => {
    const order = ["alpha", "beta", "gamma"];

    expect(reorderDashboardCardOrder(order, "alpha", "alpha", "before")).toEqual(order);
    expect(reorderDashboardCardOrder(order, "missing", "alpha", "before")).toEqual(order);
    expect(reorderDashboardCardOrder(order, "alpha", "missing", "after")).toEqual(order);
  });
});
