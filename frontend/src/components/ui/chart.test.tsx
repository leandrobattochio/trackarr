import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  Tooltip: (props: any) => <div data-testid="chart-tooltip-primitive" {...props} />,
  Legend: (props: any) => <div data-testid="chart-legend-primitive" {...props} />,
}));

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  getPayloadConfigFromPayload,
} from "@/components/ui/chart";

function TestIcon() {
  return <svg data-testid="chart-icon" />;
}

describe("chart ui", () => {
  it("renders container styles and recharts primitives", () => {
    render(
      <ChartContainer
        id="sales"
        config={{
          revenue: { label: "Revenue", color: "#f00" },
          cost: { label: "Cost", theme: { light: "#0f0", dark: "#00f" } },
        }}
      >
        <div>Chart body</div>
      </ChartContainer>,
    );

    expect(screen.getByText("Chart body")).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    const style = document.querySelector("style");
    expect(style?.innerHTML).toContain("--color-revenue: #f00;");
    expect(style?.innerHTML).toContain(".dark [data-chart=chart-sales]");
  });

  it("returns null chart style when there are no colors", () => {
    const { container } = render(<ChartStyle id="plain" config={{ metric: { label: "Metric" } }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("skips missing themed colors when generating chart styles", () => {
    render(
      <ChartStyle
        id="partial-theme"
        config={{
          metric: {
            label: "Metric",
            theme: { light: "#123456" } as any,
          },
        }}
      />,
    );

    const style = document.querySelector("style");
    expect(style?.innerHTML).toContain("--color-metric: #123456;");
    expect(style?.innerHTML).not.toContain(".dark [data-chart=partial-theme] {\n  --color-metric:");
  });

  it("renders tooltip content with label, icon, formatter, and hidden indicator states", () => {
    const config = {
      revenue: { label: "Revenue", icon: TestIcon, color: "#f00" },
      seriesLabel: { label: "Series Label", color: "#0f0" },
      costs: { label: "Costs", color: "#00f" },
    };

    const { rerender } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          label="revenue"
          payload={[
            { dataKey: "revenue", name: "revenue", value: 1200, color: "#f00", payload: { fill: "#f00" } } as any,
          ]}
        />
      </ChartContainer>,
    );

    expect(screen.getAllByText("Revenue").length).toBeGreaterThan(0);
    expect(screen.getByTestId("chart-icon")).toBeInTheDocument();
    expect(screen.getByText("1.200")).toBeInTheDocument();

    rerender(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          indicator="line"
          label="ignored"
          labelFormatter={(value) => <>Formatted {String(value)}</>}
          payload={[
            { dataKey: "seriesLabel", name: "costs", value: 40, color: "#00f", payload: { fill: "#00f", seriesLabel: "costs" } } as any,
          ]}
        />
      </ChartContainer>,
    );

    expect(screen.getByText("Formatted ignored")).toBeInTheDocument();
    expect(screen.getByText("Costs")).toBeInTheDocument();

    rerender(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          hideIndicator
          hideLabel
          formatter={(value, name) => <div>{`${name}:${value}`}</div>}
          payload={[
            { dataKey: "revenue", name: "revenue", value: 8, color: "#f00", payload: { fill: "#f00" } } as any,
          ]}
        />
      </ChartContainer>,
    );

    expect(screen.getByText("revenue:8")).toBeInTheDocument();
  });

  it("returns null for inactive tooltip and empty legend payload", () => {
    const { container, rerender } = render(
      <ChartContainer config={{ revenue: { label: "Revenue", color: "#f00" } }}>
        <ChartTooltipContent active={false} payload={[]} />
      </ChartContainer>,
    );
    expect(container.textContent).not.toContain("Revenue");

    rerender(
      <ChartContainer config={{ revenue: { label: "Revenue", color: "#f00" } }}>
        <ChartLegendContent payload={[]} />
      </ChartContainer>,
    );
    expect(container.textContent).not.toContain("Revenue");
  });

  it("handles missing labels and invalid payload config lookups", () => {
    const { container, rerender } = render(
      <ChartContainer config={{ revenue: { label: "Revenue", color: "#f00" } }}>
        <ChartTooltipContent
          active
          label="unknown"
          payload={[
            { dataKey: "metric", name: "metric", value: 0, color: "#f00", payload: { fill: "#f00" } } as any,
          ]}
        />
      </ChartContainer>,
    );

    expect(container.textContent).toContain("metric");
    expect(container.textContent).toContain("unknown");

    expect(getPayloadConfigFromPayload({ revenue: { label: "Revenue", color: "#f00" } }, null, "revenue")).toBeUndefined();
    expect(getPayloadConfigFromPayload({ revenue: { label: "Revenue", color: "#f00" } }, "bad-payload" as any, "revenue")).toBeUndefined();

    rerender(
      <ChartContainer config={{ revenue: { label: "Revenue", color: "#f00" } }}>
        <ChartLegendContent payload={[{ value: "legend", color: "#f00" } as any]} />
      </ChartContainer>,
    );

    expect(container.textContent).not.toContain("Revenue");
  });

  it("resolves config keys from payload fields and nested payload fields", () => {
    render(
      <ChartContainer
        config={{
          revenue: { label: "Revenue", color: "#f00" },
          cost: { label: "Cost", color: "#0f0" },
        }}
      >
        <>
          <ChartTooltipContent
            active
            nameKey="series"
            payload={[
              { dataKey: "metric", name: "ignored", series: "revenue", value: 5, color: "#f00", payload: { fill: "#f00" } } as any,
            ]}
          />
          <ChartLegendContent
            nameKey="series"
            hideIcon
            payload={[
              { value: "legend-1", color: "#0f0", payload: { series: "cost" } } as any,
            ]}
          />
        </>
      </ChartContainer>,
    );

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Cost")).toBeInTheDocument();
  });

  it("uses labelKey and item dataKey fallbacks in tooltip rows", () => {
    render(
      <ChartContainer
        config={{
          amount: { label: "Amount", color: "#123" },
        }}
      >
        <ChartTooltipContent
          active
          labelKey="series"
          payload={[
            { dataKey: "amount", value: 9, color: "#123", payload: { fill: undefined, series: "amount" } } as any,
          ]}
        />
      </ChartContainer>,
    );

    expect(screen.getAllByText("Amount").length).toBeGreaterThan(0);
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("falls back to the value key for tooltip labels and row config lookup", () => {
    render(
      <ChartContainer
        config={{
          value: { label: "Total", color: "#456" },
        }}
      >
        <ChartTooltipContent
          active
          indicator="dashed"
          payload={[
            { value: 12, color: "#456", payload: { fill: undefined } } as any,
          ]}
        />
      </ChartContainer>,
    );

    expect(screen.getAllByText("Total").length).toBeGreaterThan(0);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders legend content with icons, color blocks, and exported primitives", () => {
    render(
      <ChartContainer
        config={{
          revenue: { label: "Revenue", icon: TestIcon, color: "#f00" },
          cost: { label: "Cost", color: "#0f0" },
        }}
      >
        <>
          <ChartTooltip />
          <ChartLegend />
          <ChartLegendContent
            verticalAlign="top"
            payload={[
              { value: "rev", dataKey: "revenue", color: "#f00" } as any,
              { value: "cost", dataKey: "cost", color: "#0f0" } as any,
            ]}
          />
        </>
      </ChartContainer>,
    );

    expect(screen.getByTestId("chart-tooltip-primitive")).toBeInTheDocument();
    expect(screen.getByTestId("chart-legend-primitive")).toBeInTheDocument();
    expect(screen.getAllByTestId("chart-icon").length).toBeGreaterThan(0);
    expect(screen.getByText("Cost")).toBeInTheDocument();
  });

  it("throws when chart content is rendered outside a chart container", () => {
    expect(() =>
      render(
        <ChartLegendContent
          payload={[{ value: "legend", dataKey: "revenue", color: "#f00" } as any]}
        />,
      ),
    ).toThrow("useChart must be used within a <ChartContainer />");
  });
});
