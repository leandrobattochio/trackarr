import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("lucide-react", () => ({
  Activity: () => <svg data-testid="icon-activity" />,
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
  ArrowDownCircle: () => <svg data-testid="icon-arrow-down" />,
  ChartLine: () => <svg data-testid="icon-chart-line" />,
  Disc3: () => <svg data-testid="icon-disc" />,
  RefreshCcw: () => <svg data-testid="icon-refresh" />,
  Trash2: () => <svg data-testid="icon-trash" />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, asChild, className, ...props }: any) => {
    if (asChild) {
      return <span data-testid="button-as-child" className={className}>{children}</span>;
    }

    return (
      <button type="button" onClick={onClick} disabled={disabled} className={className} {...props}>
        {children}
      </button>
    );
  },
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: any) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: any) => <div>{children}</div>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h4>{children}</h4>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogCancel: ({ children, disabled }: any) => <button type="button" disabled={disabled}>{children}</button>,
  AlertDialogAction: ({ children, onClick, disabled }: any) => (
    <button type="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

vi.mock("@/features/integrations/components/EditIntegrationDialog", () => ({
  EditIntegrationDialog: ({ disabled }: any) => <div>{`edit-disabled:${String(disabled)}`}</div>,
}));

vi.mock("@/features/integrations/components/shared/MetricTooltip", () => ({
  MetricTooltip: ({ children, label, eyebrow, description }: any) => (
    <div data-testid="metric-tooltip">
      <span>{label}</span>
      <span>{eyebrow}</span>
      <span>{description}</span>
      {children}
    </div>
  ),
}));

import { TrackerCardFooter } from "@/features/integrations/plugins/shared/TrackerCardFooter";
import type { TrackerIntegration } from "@/features/integrations/types";

function buildTracker(overrides: Partial<TrackerIntegration> = {}): TrackerIntegration {
  return {
    id: "tracker-1",
    pluginId: "seedpool",
    dashboard: { metrics: [] },
    byteUnitSystem: "binary",
    name: "Seedpool",
    payload: {},
    url: null,
    ratio: 1.5,
    uploaded: 1,
    downloaded: 1,
    seedBonus: null,
    buffer: null,
    hitAndRuns: 3,
    requiredRatio: 1,
    seedingTorrents: 10,
    leechingTorrents: 2,
    activeTorrents: 12,
    lastSync: "2 min ago",
    lastSyncExact: "2026-04-06 10:00 UTC",
    nextAutomaticSync: "in 58 min",
    nextAutomaticSyncExact: "2026-04-06 11:00 UTC",
    status: "success",
    statusLabel: "success",
    configurationValid: true,
    configurationError: null,
    ...overrides,
  };
}

describe("TrackerCardFooter", () => {
  it("renders status chips, sync button, snapshots link, and delete flow", () => {
    const onSync = vi.fn();
    const onDelete = vi.fn();

    render(
      <TrackerCardFooter
        tracker={buildTracker()}
        actionsDisabled={false}
        isSyncing={false}
        isDeleting={false}
        onSync={onSync}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("2 min ago (2026-04-06 10:00 UTC)")).toBeInTheDocument();
    expect(screen.getByText("in 58 min (2026-04-06 11:00 UTC)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete integration" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Sync$/i }));
    expect(onSync).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /^Delete$/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "View snapshots" })).toHaveAttribute("href", "/snapshots?integrationId=tracker-1");
  });

  it("covers disabled actions, configuration warning, and unscheduled/never synced text", () => {
    render(
      <TrackerCardFooter
        tracker={buildTracker({
          configurationValid: false,
          configurationError: "Definition mismatch",
          seedingTorrents: null,
          leechingTorrents: null,
          activeTorrents: null,
          lastSync: null,
          lastSyncExact: null,
          nextAutomaticSync: null,
          nextAutomaticSyncExact: null,
        })}
        actionsDisabled={true}
        isSyncing={true}
        isDeleting={true}
        onSync={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Integration needs fixing")).toBeInTheDocument();
    expect(screen.getAllByText("Definition mismatch").length).toBeGreaterThan(0);
    expect(screen.getByText("Never synced")).toBeInTheDocument();
    expect(screen.getByText("Not scheduled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Delete integration/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Syncing\.\.\.$/i })).toBeDisabled();
    expect(screen.getByText("edit-disabled:true")).toBeInTheDocument();
  });

  it("uses default configuration warning copy when no explicit error is present", () => {
    render(
      <TrackerCardFooter
        tracker={buildTracker({
          configurationValid: false,
          configurationError: null,
        })}
        actionsDisabled={false}
        isSyncing={false}
        isDeleting={false}
        onSync={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("This integration no longer matches the current plugin definition.")).toBeInTheDocument();
  });
});
