import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => ({
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
  Unplug: () => <svg data-testid="icon-unplug" />,
}));

vi.mock("@/features/integrations/plugins/shared/TrackerCardShell", () => ({
  TrackerCardShell: ({ ratio, metrics, reorderControls }: any) => (
    <div data-testid="tracker-card-shell">
      <div data-testid="ratio-slot">{ratio}</div>
      <div data-testid="metrics-slot">{metrics}</div>
      <div>{reorderControls}</div>
    </div>
  ),
}));

vi.mock("@/features/integrations/plugins/shared/RatioThresholdCard", () => ({
  RatioThresholdCard: ({ ratio, requiredRatio }: any) => (
    <div data-testid="ratio-threshold-card">{`ratio:${ratio}-required:${requiredRatio}`}</div>
  ),
}));

import { MissingPluginTrackerCard } from "@/features/integrations/plugins/MissingPluginTrackerCard";
import type { TrackerIntegration } from "@/features/integrations/types";

const baseTracker: TrackerIntegration = {
  id: "tracker-1",
  pluginId: "missing-plugin",
  dashboard: null,
  byteUnitSystem: "binary",
  name: "Missing Plugin",
  payload: {},
  url: null,
  ratio: 0.8,
  uploaded: 10,
  downloaded: 20,
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
  status: "unknownError",
  statusLabel: "unknown error",
  configurationValid: false,
  configurationError: null,
};

describe("MissingPluginTrackerCard", () => {
  it("renders fallback message with default missing plugin text", () => {
    render(
      <MissingPluginTrackerCard
        tracker={baseTracker}
        reorderControls={<span>reorder-controls</span>}
      />,
    );

    expect(screen.getByTestId("tracker-card-shell")).toBeInTheDocument();
    expect(screen.getByTestId("ratio-threshold-card")).toHaveTextContent("ratio:0.8-required:1");
    expect(screen.getByText("Plugin definition unavailable")).toBeInTheDocument();
    expect(screen.getByText("Plugin 'missing-plugin' was not found.")).toBeInTheDocument();
    expect(screen.getByText("reorder-controls")).toBeInTheDocument();
  });

  it("renders explicit configuration error when available", () => {
    render(
      <MissingPluginTrackerCard
        tracker={{ ...baseTracker, configurationError: "Plugin dashboard metrics removed" }}
      />,
    );

    expect(screen.getByText("Plugin dashboard metrics removed")).toBeInTheDocument();
  });
});
