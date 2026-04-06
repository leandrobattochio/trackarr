import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => ({
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
  ExternalLink: () => <svg data-testid="icon-external-link" />,
  GripVertical: () => <svg data-testid="icon-grip" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, variant }: any) => <div data-testid="badge" data-variant={variant}>{children}</div>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: any) => <div data-testid="card" className={className}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));

vi.mock("@/features/integrations/components/shared/MetricTooltip", () => ({
  MetricTooltip: ({ children }: any) => <div data-testid="metric-tooltip">{children}</div>,
}));

vi.mock("@/features/integrations/plugins/shared/TrackerCardFooter", () => ({
  TrackerCardFooter: ({ onSync, onDelete, actionsDisabled }: any) => (
    <div data-testid="tracker-footer">
      <button type="button" onClick={onSync}>sync-now</button>
      <button type="button" onClick={onDelete}>delete-now</button>
      <span>{`disabled:${String(actionsDisabled)}`}</span>
    </div>
  ),
}));

const hookState = {
  actionsDisabled: false,
  handleDelete: vi.fn(),
  handleSync: vi.fn(),
  isDeleting: false,
  isSyncing: false,
};

vi.mock("@/features/integrations/plugins/shared/useTrackerCardActions", () => ({
  useTrackerCardActions: () => hookState,
}));

import { TrackerCardShell } from "@/features/integrations/plugins/shared/TrackerCardShell";
import type { TrackerIntegration } from "@/features/integrations/types";

function buildTracker(overrides: Partial<TrackerIntegration> = {}): TrackerIntegration {
  return {
    id: "tracker-1",
    pluginId: "seedpool",
    dashboard: { metrics: [] },
    byteUnitSystem: "binary",
    name: "Seedpool",
    payload: {},
    url: "https://seedpool.org",
    ratio: 1.5,
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
    ...overrides,
  };
}

describe("TrackerCardShell", () => {
  it("renders normal status badge, footer actions, and external link", () => {
    render(
      <TrackerCardShell
        tracker={buildTracker()}
        ratio={<div>ratio-slot</div>}
        metrics={<div>metrics-slot</div>}
        reorderControls={<span>reorder-controls</span>}
      />,
    );

    expect(screen.getByText("Seedpool")).toBeInTheDocument();
    expect(screen.getByText("ratio-slot")).toBeInTheDocument();
    expect(screen.getByText("metrics-slot")).toBeInTheDocument();
    expect(screen.getByText("reorder-controls")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toHaveAttribute("data-variant", "default");
    expect(screen.getByLabelText("Open Seedpool")).toHaveAttribute("href", "https://seedpool.org");

    screen.getByText("sync-now").click();
    screen.getByText("delete-now").click();
    expect(hookState.handleSync).toHaveBeenCalledTimes(1);
    expect(hookState.handleDelete).toHaveBeenCalledTimes(1);
  });

  it("covers pending/error badge variants, ratio warning, and fixing state", () => {
    const { rerender } = render(
      <TrackerCardShell
        tracker={buildTracker({ status: "pending", statusLabel: "pending", url: null })}
        ratio={<div>ratio</div>}
        metrics={<div>metrics</div>}
      />,
    );

    expect(screen.getByTestId("badge")).toHaveAttribute("data-variant", "secondary");
    expect(screen.queryByLabelText("Open Seedpool")).not.toBeInTheDocument();

    rerender(
      <TrackerCardShell
        tracker={buildTracker({
          status: "authFailed",
          statusLabel: "auth failed",
          ratio: 0.7,
          requiredRatio: 1,
          configurationValid: false,
        })}
        ratio={<div>ratio</div>}
        metrics={<div>metrics</div>}
      />,
    );

    expect(screen.getByTestId("badge")).toHaveAttribute("data-variant", "destructive");
    expect(screen.getByText("needs fixing")).toBeInTheDocument();
    expect(screen.getByLabelText("Ratio warning details")).toBeInTheDocument();
    expect(screen.getByText("disabled:false")).toBeInTheDocument();

    rerender(
      <TrackerCardShell
        tracker={buildTracker({
          status: "unknownError",
          statusLabel: "unknown error",
          configurationValid: true,
        })}
        ratio={<div>ratio</div>}
        metrics={<div>metrics</div>}
      />,
    );

    expect(screen.getByTestId("badge")).toHaveAttribute("data-variant", "destructive");
  });
});
