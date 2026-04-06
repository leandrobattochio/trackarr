import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/integrations/components/shared/MetricTooltip", () => ({
  MetricTooltip: ({ children, label, eyebrow, description }: unknown) => (
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

import { RatioThresholdCard } from "@/features/integrations/plugins/shared/RatioThresholdCard";

describe("RatioThresholdCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders success ratio state and above-minimum message", () => {
    render(<RatioThresholdCard ratio={2.2} requiredRatio={1.1} />);

    expect(screen.getAllByText("2.20").length).toBeGreaterThan(0);
    expect(screen.getByText("+1.10 above minimum")).toBeInTheDocument();
    expect(screen.getByText("Minimum 1.10")).toBeInTheDocument();
    expect(screen.getByText("1.10 required")).toBeInTheDocument();
  });

  it("renders warning and destructive ratio states plus null fallback copy", () => {
    const { rerender } = render(<RatioThresholdCard ratio={0.9} requiredRatio={1} />);
    expect(screen.getByText("-0.10 below minimum")).toBeInTheDocument();

    rerender(<RatioThresholdCard ratio={0.5} requiredRatio={1} />);
    expect(screen.getByText("-0.50 below minimum")).toBeInTheDocument();

    rerender(<RatioThresholdCard ratio={null} requiredRatio={null} />);
    expect(screen.getByText("--")).toBeInTheDocument();
    expect(screen.getByText("Set a required ratio to compare against")).toBeInTheDocument();
  });

  it("covers primary ratio color and initial hidden animation state", () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const { container } = render(<RatioThresholdCard ratio={1.2} requiredRatio={1} />);

    expect(container.firstElementChild).toHaveClass("opacity-0");
    expect(screen.getByRole("button", { name: "Current ratio details" })).toHaveClass("text-primary");
    expect(rafSpy).toHaveBeenCalled();
  });

  it("shows the visible animation class after frame callback", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const { container } = render(<RatioThresholdCard ratio={1.4} requiredRatio={1} />);
    expect(container.firstElementChild).toHaveClass("opacity-100");
  });
});

