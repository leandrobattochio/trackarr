import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => ({
  ArrowDownToLine: () => <svg data-testid="icon-arrow-down" />,
  ArrowUpFromLine: () => <svg data-testid="icon-arrow-up" />,
  BarChart3: () => <svg data-testid="icon-fallback" />,
  Coins: () => <svg data-testid="icon-coins" />,
  HardDrive: () => <svg data-testid="icon-hard-drive" />,
  ShieldAlert: () => <svg data-testid="icon-shield-alert" />,
}));

vi.mock("@/features/integrations/plugins/shared/TrackerCardShell", () => ({
  TrackerCardShell: ({ ratio, metrics }: any) => (
    <div data-testid="tracker-card-shell">
      <div data-testid="ratio-slot">{ratio}</div>
      <div data-testid="metrics-slot">{metrics}</div>
    </div>
  ),
}));

vi.mock("@/features/integrations/plugins/shared/TrackerMetricTile", () => ({
  BytesMetricTile: ({ label, iconClassName, value, unitSystem }: any) => (
    <div data-testid="bytes-metric">{`${label}|${iconClassName}|${value}|${unitSystem}`}</div>
  ),
  CountMetricTile: ({ label, iconClassName, value }: any) => (
    <div data-testid="count-metric">{`${label}|${iconClassName}|${value}`}</div>
  ),
  TextMetricTile: ({ label, iconClassName, value }: any) => (
    <div data-testid="text-metric">{`${label}|${iconClassName}|${value}`}</div>
  ),
}));

vi.mock("@/features/integrations/plugins/shared/RatioThresholdCard", () => ({
  RatioThresholdCard: ({ ratio, requiredRatio }: any) => (
    <div data-testid="ratio-threshold-card">{`ratio:${ratio}-required:${requiredRatio}`}</div>
  ),
}));

import { ConfiguredTrackerCard } from "@/features/integrations/plugins/ConfiguredTrackerCard";
import type { TrackerIntegration } from "@/features/integrations/types";

function buildTracker(metrics: any[]): TrackerIntegration {
  return {
    id: "tracker-1",
    pluginId: "seedpool",
    dashboard: {
      metrics,
    },
    byteUnitSystem: "decimal",
    name: "Seedpool",
    payload: {},
    url: null,
    ratio: 1.25,
    uploaded: 2048,
    downloaded: 1024,
    seedBonus: "120",
    buffer: "10 GiB",
    hitAndRuns: 3,
    requiredRatio: 1,
    seedingTorrents: 8,
    leechingTorrents: 2,
    activeTorrents: 10,
    lastSync: "now",
    lastSyncExact: "exact",
    nextAutomaticSync: "soon",
    nextAutomaticSyncExact: "exact",
    status: "success",
    statusLabel: "success",
    configurationValid: true,
    configurationError: null,
  };
}

describe("ConfiguredTrackerCard", () => {
  it("renders bytes/count/text tiles with known icons and tones", () => {
    const tracker = buildTracker([
      { stat: "uploadedBytes", label: "Uploaded", format: "bytes", icon: "arrow-up", tone: "success" },
      { stat: "activeTorrents", label: "Active", format: "count", icon: "hard-drive", tone: "primary" },
      { stat: "seedBonus", label: "Seed Bonus", format: "text", icon: "coins", tone: "warning" },
    ]);

    render(<ConfiguredTrackerCard tracker={tracker} />);

    expect(screen.getByTestId("ratio-threshold-card")).toHaveTextContent("ratio:1.25-required:1");
    expect(screen.getByTestId("bytes-metric")).toHaveTextContent("Uploaded|text-success|2048|decimal");
    expect(screen.getByTestId("count-metric")).toHaveTextContent("Active|text-primary|10");
    expect(screen.getByTestId("text-metric")).toHaveTextContent("Seed Bonus|text-warning|120");
  });

  it("uses fallback icon, fallback tone, and null-safe stat formatting paths", () => {
    const tracker = buildTracker([
      { stat: "requiredRatio", label: "Required Ratio", format: "text", icon: "unknown-icon", tone: "unknown-tone" },
      { stat: "ratio", label: "Current Ratio", format: "text", icon: "unknown-icon", tone: "unknown-tone" },
      { stat: "unknown-stat", label: "Unknown", format: "bytes", icon: "unknown-icon", tone: "unknown-tone" } as any,
    ]);

    render(<ConfiguredTrackerCard tracker={tracker} />);

    const metricsContainer = screen.getByTestId("metrics-slot").firstElementChild as HTMLElement;
    expect(metricsContainer.className).toContain("grid-cols-3");
    expect(screen.getAllByTestId("text-metric")[0]).toHaveTextContent("Required Ratio|text-primary|1.00");
    expect(screen.getAllByTestId("text-metric")[1]).toHaveTextContent("Current Ratio|text-primary|1.25");
    expect(screen.getByTestId("bytes-metric")).toHaveTextContent("Unknown|text-primary|null|decimal");
  });

  it("covers grid layout branches for 1, 2, and 4+ metrics", () => {
    const { rerender } = render(
      <ConfiguredTrackerCard
        tracker={buildTracker([{ stat: "buffer", label: "Buffer", format: "text", icon: "coins", tone: "muted" }])}
      />,
    );

    let metricsContainer = screen.getByTestId("metrics-slot").firstElementChild as HTMLElement;
    expect(metricsContainer.className).toContain("grid-cols-1");

    rerender(
      <ConfiguredTrackerCard
        tracker={buildTracker([
          { stat: "uploadedBytes", label: "Uploaded", format: "bytes", icon: "arrow-up", tone: "success" },
          { stat: "downloadedBytes", label: "Downloaded", format: "bytes", icon: "arrow-down", tone: "primary" },
        ])}
      />,
    );
    metricsContainer = screen.getByTestId("metrics-slot").firstElementChild as HTMLElement;
    expect(metricsContainer.className).toContain("grid-cols-2");

    rerender(
      <ConfiguredTrackerCard
        tracker={buildTracker([
          { stat: "uploadedBytes", label: "Uploaded", format: "bytes", icon: "arrow-up", tone: "success" },
          { stat: "downloadedBytes", label: "Downloaded", format: "bytes", icon: "arrow-down", tone: "primary" },
          { stat: "activeTorrents", label: "Active", format: "count", icon: "hard-drive", tone: "primary" },
          { stat: "hitAndRuns", label: "HnR", format: "count", icon: "shield-alert", tone: "destructive" },
        ])}
      />,
    );
    metricsContainer = screen.getByTestId("metrics-slot").firstElementChild as HTMLElement;
    expect(metricsContainer.className).toContain("xl:grid-cols-4");
  });

  it("formats text tiles for torrent counters and hit-and-runs", () => {
    const tracker = buildTracker([
      { stat: "seedingTorrents", label: "Seeding", format: "text", icon: "coins", tone: "success" },
      { stat: "leechingTorrents", label: "Leeching", format: "text", icon: "coins", tone: "warning" },
      { stat: "activeTorrents", label: "Active", format: "text", icon: "coins", tone: "primary" },
      { stat: "hitAndRuns", label: "H&R", format: "text", icon: "coins", tone: "destructive" },
    ]);

    render(<ConfiguredTrackerCard tracker={tracker} />);

    const tiles = screen.getAllByTestId("text-metric");
    expect(tiles[0]).toHaveTextContent("Seeding|text-success|8");
    expect(tiles[1]).toHaveTextContent("Leeching|text-warning|2");
    expect(tiles[2]).toHaveTextContent("Active|text-primary|10");
    expect(tiles[3]).toHaveTextContent("H&R|text-destructive|3");
  });

  it("covers number metric switch cases and text null/default branches", () => {
    const tracker = buildTracker([
      { stat: "seedingTorrents", label: "Seed Count", format: "count", icon: "coins", tone: "success" },
      { stat: "leechingTorrents", label: "Leech Count", format: "count", icon: "coins", tone: "warning" },
      { stat: "ratio", label: "Ratio Null", format: "text", icon: "coins", tone: "primary" },
      { stat: "requiredRatio", label: "Required Null", format: "text", icon: "coins", tone: "primary" },
      { stat: "unknown-stat", label: "Unknown Text", format: "text", icon: "coins", tone: "primary" } as any,
    ]);

    tracker.ratio = null;
    tracker.requiredRatio = null;
    tracker.seedingTorrents = 11;
    tracker.leechingTorrents = 7;

    render(<ConfiguredTrackerCard tracker={tracker} />);

    const countTiles = screen.getAllByTestId("count-metric");
    expect(countTiles[0]).toHaveTextContent("Seed Count|text-success|11");
    expect(countTiles[1]).toHaveTextContent("Leech Count|text-warning|7");

    const textTiles = screen.getAllByTestId("text-metric");
    expect(textTiles[0]).toHaveTextContent("Ratio Null|text-primary|null");
    expect(textTiles[1]).toHaveTextContent("Required Null|text-primary|null");
    expect(textTiles[2]).toHaveTextContent("Unknown Text|text-primary|null");
  });

  it("returns null text values when torrent counters are null", () => {
    const tracker = buildTracker([
      { stat: "seedingTorrents", label: "Seeding Null", format: "text", icon: "coins", tone: "muted" },
      { stat: "leechingTorrents", label: "Leeching Null", format: "text", icon: "coins", tone: "muted" },
      { stat: "activeTorrents", label: "Active Null", format: "text", icon: "coins", tone: "muted" },
      { stat: "hitAndRuns", label: "H&R Null", format: "text", icon: "coins", tone: "muted" },
    ]);

    tracker.seedingTorrents = null;
    tracker.leechingTorrents = null;
    tracker.activeTorrents = null;
    tracker.hitAndRuns = null;

    render(<ConfiguredTrackerCard tracker={tracker} />);

    const tiles = screen.getAllByTestId("text-metric");
    expect(tiles[0]).toHaveTextContent("Seeding Null|text-muted-foreground|null");
    expect(tiles[1]).toHaveTextContent("Leeching Null|text-muted-foreground|null");
    expect(tiles[2]).toHaveTextContent("Active Null|text-muted-foreground|null");
    expect(tiles[3]).toHaveTextContent("H&R Null|text-muted-foreground|null");
  });
});
