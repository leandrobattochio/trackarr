import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/integrations/components/shared/MetricTooltip", () => ({
  MetricTooltip: ({ label, eyebrow, description, children }: any) => (
    <div data-testid="metric-tooltip">
      <span>{label}</span>
      <span>{eyebrow}</span>
      <span>{description}</span>
      {children}
    </div>
  ),
}));

vi.mock("@/shared/hooks/use-animated-number", () => ({
  useAnimatedNumber: (value: number) => value,
}));

vi.mock("@/shared/lib/formatters", () => ({
  formatBytes: (value: number, unitSystem: string) => `${value}-${unitSystem}`,
}));

import {
  BytesMetricTile,
  CountMetricTile,
  TextMetricTile,
  TrackerMetricTile,
} from "@/features/integrations/plugins/shared/TrackerMetricTile";

function IconStub() {
  return <svg data-testid="icon-stub" />;
}

describe("TrackerMetricTile", () => {
  it("renders direct tile value and default tooltip copy", () => {
    render(
      <TrackerMetricTile
        label="Custom Metric"
        icon={IconStub}
        iconClassName="text-primary"
        value="42"
      />,
    );

    expect(screen.getByTestId("icon-stub")).toBeInTheDocument();
    expect(screen.getByText("Tracker Metric")).toBeInTheDocument();
    expect(screen.getByText("Current custom metric value for this integration.")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders bytes and count values with null and non-null branches", () => {
    const { rerender } = render(
      <BytesMetricTile
        label="Uploaded"
        icon={IconStub}
        iconClassName="text-success"
        value={2048}
        unitSystem="binary"
      />,
    );

    expect(screen.getByText("Transfer")).toBeInTheDocument();
    expect(screen.getByText("2048-binary")).toBeInTheDocument();

    rerender(
      <BytesMetricTile
        label="Downloaded"
        icon={IconStub}
        iconClassName="text-primary"
        value={null}
        unitSystem="decimal"
      />,
    );
    expect(screen.getByText("--")).toBeInTheDocument();

    rerender(
      <CountMetricTile
        label="Hit & Runs"
        icon={IconStub}
        iconClassName="text-warning"
        value={1200}
      />,
    );
    expect(screen.getByText("1.200")).toBeInTheDocument();

    rerender(
      <CountMetricTile
        label="Leeching"
        icon={IconStub}
        iconClassName="text-warning"
        value={null}
      />,
    );
    expect(screen.getByText("--")).toBeInTheDocument();
  });

  it("covers static text tooltip copy branches", () => {
    const { rerender } = render(
      <TextMetricTile
        label="Seed Bonus"
        icon={IconStub}
        iconClassName="text-warning"
        value="50"
      />,
    );
    expect(screen.getByText("Reward")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();

    rerender(
      <TextMetricTile
        label="Buffer"
        icon={IconStub}
        iconClassName="text-primary"
        value="5 GiB"
      />,
    );
    expect(screen.getByText("Capacity")).toBeInTheDocument();

    rerender(
      <TextMetricTile
        label="Uploaded"
        icon={IconStub}
        iconClassName="text-primary"
        value={null}
      />,
    );
    expect(screen.getByText("Transfer")).toBeInTheDocument();
    expect(screen.getByText("--")).toBeInTheDocument();
  });
});
