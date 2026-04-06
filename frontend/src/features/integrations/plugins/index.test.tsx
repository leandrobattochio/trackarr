import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/integrations/plugins/ConfiguredTrackerCard", () => ({
  ConfiguredTrackerCard: () => <div data-testid="configured-card">configured</div>,
}));

vi.mock("@/features/integrations/plugins/MissingPluginTrackerCard", () => ({
  MissingPluginTrackerCard: () => <div data-testid="missing-card">missing</div>,
}));

import { PluginTrackerCard } from "@/features/integrations/plugins";
import type { TrackerIntegration } from "@/features/integrations/types";

function buildTracker(dashboard: TrackerIntegration["dashboard"]): TrackerIntegration {
  return {
    id: "tracker-1",
    pluginId: "seedpool",
    dashboard,
    byteUnitSystem: "binary",
    name: "Seedpool",
    payload: {},
    url: null,
    ratio: 1.2,
    uploaded: 1,
    downloaded: 1,
    seedBonus: null,
    buffer: null,
    hitAndRuns: null,
    requiredRatio: 1,
    seedingTorrents: null,
    leechingTorrents: null,
    activeTorrents: null,
    lastSync: null,
    lastSyncExact: null,
    nextAutomaticSync: null,
    nextAutomaticSyncExact: null,
    status: "success",
    statusLabel: "success",
    configurationValid: true,
    configurationError: null,
  };
}

describe("PluginTrackerCard", () => {
  it("renders missing card when dashboard config is null", () => {
    render(<PluginTrackerCard tracker={buildTracker(null)} />);
    expect(screen.getByTestId("missing-card")).toBeInTheDocument();
  });

  it("renders configured card when dashboard config exists", () => {
    render(<PluginTrackerCard tracker={buildTracker({ metrics: [] })} />);
    expect(screen.getByTestId("configured-card")).toBeInTheDocument();
  });
});
