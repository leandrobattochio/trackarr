import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const linePropsList: unknown[] = [];
const chartTooltipContentProps: unknown[] = [];

vi.mock("recharts", () => ({
  CartesianGrid: () => <div data-testid="grid" />,
  LineChart: ({ children }: unknown) => <div data-testid="line-chart">{children}</div>,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: ({ tickFormatter, width }: unknown) => (
    <div data-testid="y-axis" data-width={width}>
      {tickFormatter(1234)}
    </div>
  ),
  Line: (props: unknown) => {
    linePropsList.push(props);
    return <div data-testid={`line-${props.dataKey}`}>{String(props.strokeWidth)}</div>;
  },
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange }: unknown) => (
    <button type="button" onClick={() => onCheckedChange(!checked)}>
      checkbox:{String(checked)}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: unknown) => <div>{children}</div>,
  CardHeader: ({ children }: unknown) => <div>{children}</div>,
  CardTitle: ({ children }: unknown) => <h2>{children}</h2>,
  CardContent: ({ children }: unknown) => <div>{children}</div>,
}));

vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: unknown) => <div>{children}</div>,
  ChartLegend: ({ content }: unknown) => <div>{content}</div>,
  ChartLegendContent: () => <div data-testid="legend-content" />,
  ChartTooltip: ({ content }: unknown) => <div>{content}</div>,
  ChartTooltipContent: (props: unknown) => {
    chartTooltipContentProps.push(props);
    return <div data-testid="tooltip-content" />;
  },
}));

import { SnapshotLineChartCard } from "@/features/snapshots/components/SnapshotLineChartCard";

describe("SnapshotLineChartCard", () => {
  it("renders series toggles, visible lines, and tooltip formatters", () => {
    linePropsList.length = 0;
    chartTooltipContentProps.length = 0;

    const onToggleSeries = vi.fn();
    const tooltipValueFormatter = vi.fn((value: number, name: string) => ({ label: `${name}-label`, value: `${value}` }));
    const tooltipLabelFormatter = vi.fn((iso: string) => `formatted:${iso}`);
    const yAxisFormatter = vi.fn((value: number) => `${value}-unit`);

    render(
      <SnapshotLineChartCard
        title="Ratio History"
        description="Snapshot trend"
        chartData={[{ label: "Jan 01", capturedAt: "2026-01-01T00:00:00Z", ratio: 1.2, uploaded: 100 }]}
        chartConfig={{ ratio: { label: "Ratio", color: "#fff" }, uploaded: { label: "Uploaded", color: "#000" } }}
        seriesOptions={[
          { key: "ratio", label: "Ratio", strokeToken: "#fff", strokeWidth: 4 },
          { key: "uploaded", label: "Uploaded", strokeToken: "#000" },
        ]}
        visibleSeries={{ ratio: true, uploaded: false }}
        onToggleSeries={onToggleSeries}
        yAxisWidth={66}
        yAxisFormatter={yAxisFormatter}
        tooltipValueFormatter={tooltipValueFormatter}
        tooltipLabelFormatter={tooltipLabelFormatter}
      />,
    );

    expect(screen.getByText("Ratio History")).toBeInTheDocument();
    expect(screen.getByText("Snapshot trend")).toBeInTheDocument();
    expect(screen.getByTestId("y-axis")).toHaveAttribute("data-width", "66");
    expect(yAxisFormatter).toHaveBeenCalledWith(1234);
    expect(screen.getByTestId("legend-content")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ratio" }));
    expect(onToggleSeries).toHaveBeenCalledWith("ratio", false);

    expect(screen.getByTestId("line-ratio")).toBeInTheDocument();
    expect(screen.queryByTestId("line-uploaded")).not.toBeInTheDocument();
    expect(linePropsList[0].strokeWidth).toBe(4);

    const tooltipProps = chartTooltipContentProps[0];
    expect(
      tooltipProps.labelFormatter("", [{ payload: { capturedAt: "2026-01-01T00:00:00Z" } }]),
    ).toBe("formatted:2026-01-01T00:00:00Z");
    expect(tooltipProps.labelFormatter("", undefined)).toBe("");

    tooltipProps.formatter(42, "ratio");
    expect(tooltipValueFormatter).toHaveBeenCalledWith(42, "ratio");
  });

  it("uses default line stroke width when not provided and shows all visible series", () => {
    linePropsList.length = 0;

    render(
      <SnapshotLineChartCard
        title="Traffic"
        description="All series enabled"
        chartData={[{ label: "Jan 01", capturedAt: "2026-01-01T00:00:00Z", up: 1, down: 2 }]}
        chartConfig={{ up: { label: "Up", color: "#0f0" }, down: { label: "Down", color: "#00f" } }}
        seriesOptions={[
          { key: "up", label: "Up", strokeToken: "#0f0" },
          { key: "down", label: "Down", strokeToken: "#00f" },
        ]}
        visibleSeries={{ up: true, down: true }}
        onToggleSeries={vi.fn()}
        yAxisWidth={50}
        yAxisFormatter={(value) => String(value)}
        tooltipValueFormatter={(value, name) => ({ label: String(name), value: String(value) })}
        tooltipLabelFormatter={(iso) => iso}
      />,
    );

    expect(screen.getByTestId("line-up")).toBeInTheDocument();
    expect(screen.getByTestId("line-down")).toBeInTheDocument();
    expect(linePropsList[0].strokeWidth).toBe(2);
    expect(linePropsList[1].strokeWidth).toBe(2);
  });
});

