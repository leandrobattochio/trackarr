import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => ({
  ArrowUpFromLine: (props: unknown) => <svg data-testid="icon-up" {...props} />,
  ArrowDownToLine: (props: unknown) => <svg data-testid="icon-down" {...props} />,
  Gauge: (props: unknown) => <svg data-testid="icon-gauge" {...props} />,
  Server: (props: unknown) => <svg data-testid="icon-server" {...props} />,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: unknown) => <div>{children}</div>,
  CardContent: ({ children }: unknown) => <div>{children}</div>,
}));

vi.mock("@/features/integrations/components/shared/MetricTooltip", () => ({
  MetricTooltip: ({ children, label }: unknown) => <div data-testid={`tooltip-${label}`}>{children}</div>,
}));

vi.mock("@/shared/lib/formatters", () => ({
  formatBytes: (value: number, unitSystem: string) => `${Math.round(value)}-${unitSystem}`,
}));

vi.mock("@/shared/hooks/use-animated-number", () => ({
  useAnimatedNumber: (value: number) => value,
}));

import { StatsOverview } from "@/features/integrations/components/StatsOverview";
import type { TrackerIntegration } from "@/features/integrations/types";

function tracker(overrides: Partial<TrackerIntegration> = {}): TrackerIntegration {
  return {
    id: "tracker-1",
    pluginId: "seedpool",
    dashboard: { metrics: [] },
    byteUnitSystem: "binary",
    name: "Seedpool",
    payload: {},
    url: null,
    ratio: 1,
    uploaded: 1000,
    downloaded: 500,
    seedBonus: null,
    buffer: null,
    hitAndRuns: null,
    requiredRatio: null,
    seedingTorrents: 3,
    leechingTorrents: 2,
    activeTorrents: 5,
    lastSync: null,
    lastSyncExact: null,
    nextAutomaticSync: null,
    nextAutomaticSyncExact: null,
    status: "success",
    statusLabel: "success",
    configurationValid: true,
    configurationError: null,
    ...overrides,
  };
}

describe("StatsOverview", () => {
  it("renders aggregate metrics for integrations and uses shared unit system", () => {
    render(
      <StatsOverview
        integrations={[
          tracker({ uploaded: 2000, downloaded: 1000, activeTorrents: 8, byteUnitSystem: "decimal" }),
          tracker({ id: "tracker-2", uploaded: 1000, downloaded: 500, activeTorrents: 4, byteUnitSystem: "decimal" }),
        ]}
      />,
    );

    expect(screen.getByText("3000-decimal")).toBeInTheDocument();
    expect(screen.getByText("1500-decimal")).toBeInTheDocument();
    expect(screen.getByText("2.00")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("falls back to binary when integrations are empty or mixed and warns for low ratio", () => {
    const { rerender } = render(<StatsOverview integrations={[]} />);
    expect(screen.getAllByText("0-binary").length).toBeGreaterThan(0);
    expect(screen.getByText("0.00")).toBeInTheDocument();

    rerender(
      <StatsOverview
        integrations={[
          tracker({ uploaded: 500, downloaded: 1000, byteUnitSystem: "binary" }),
          tracker({ id: "tracker-2", uploaded: 500, downloaded: 1000, byteUnitSystem: "decimal" }),
        ]}
      />,
    );

    expect(screen.getByText("1000-binary")).toBeInTheDocument();
    const gaugeIcons = screen.getAllByTestId("icon-gauge");
    expect(gaugeIcons[0].getAttribute("class")).toContain("text-warning");
  });

  it("treats null numeric stats as zero", () => {
    render(
      <StatsOverview
        integrations={[
          tracker({ uploaded: null, downloaded: null, activeTorrents: null, byteUnitSystem: "binary" }),
        ]}
      />,
    );

    expect(screen.getAllByText("0-binary").length).toBeGreaterThan(0);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});

