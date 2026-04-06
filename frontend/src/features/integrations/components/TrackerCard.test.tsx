import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/integrations/plugins", () => ({
  PluginTrackerCard: ({ tracker, reorderControls }: unknown) => (
    <div data-testid="plugin-tracker-card">
      <span>{tracker.name}</span>
      {reorderControls}
    </div>
  ),
}));

import { TrackerCard } from "@/features/integrations/components/TrackerCard";
import type { TrackerIntegration } from "@/features/integrations/types";

function buildTracker(): TrackerIntegration {
  return {
    id: "tracker-1",
    pluginId: "seedpool",
    dashboard: null,
    byteUnitSystem: "binary",
    name: "Seedpool",
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

describe("TrackerCard", () => {
  it("forwards tracker and reorder controls to plugin card", () => {
    render(
      <TrackerCard
        tracker={buildTracker()}
        reorderControls={<span>reorder</span>}
      />,
    );

    expect(screen.getByTestId("plugin-tracker-card")).toBeInTheDocument();
    expect(screen.getByText("Seedpool")).toBeInTheDocument();
    expect(screen.getByText("reorder")).toBeInTheDocument();
  });
});

