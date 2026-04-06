import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div data-testid="tooltip-root">{children}</div>,
  TooltipTrigger: ({ children }: any) => <div data-testid="tooltip-trigger">{children}</div>,
  TooltipContent: ({ children, side, className }: any) => (
    <div data-testid="tooltip-content" data-side={side} className={className}>
      {children}
    </div>
  ),
}));

import { MetricTooltip } from "@/features/integrations/components/shared/MetricTooltip";

describe("MetricTooltip", () => {
  it("renders trigger and rich tooltip content", () => {
    render(
      <MetricTooltip
        label="Current Ratio"
        eyebrow="Health Signal"
        description="Description text"
      >
        <button type="button">Trigger</button>
      </MetricTooltip>,
    );

    expect(screen.getByTestId("tooltip-root")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-trigger")).toHaveTextContent("Trigger");
    expect(screen.getByTestId("tooltip-content")).toHaveAttribute("data-side", "top");
    expect(screen.getByText("Health Signal")).toBeInTheDocument();
    expect(screen.getByText("Current Ratio")).toBeInTheDocument();
    expect(screen.getByText("Description text")).toBeInTheDocument();
  });
});
