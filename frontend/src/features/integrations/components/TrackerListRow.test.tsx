import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackerIntegration } from "@/features/integrations/types";
import { buildTracker } from "@/test/tracker-fixture";

vi.mock("@/features/integrations/components/shared/MetricTooltip", () => ({
  MetricTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/features/integrations/components/EditIntegrationDialog", () => ({
  EditIntegrationDialog: ({ disabled }: { disabled: boolean }) => (
    <button type="button" aria-label="Edit integration" disabled={disabled} />
  ),
}));

const actions = {
  actionsDisabled: false,
  isSyncing: false,
  isDeleting: false,
  handleSync: vi.fn(),
  handleDelete: vi.fn(),
};

vi.mock("@/features/integrations/plugins/shared/useTrackerCardActions", () => ({
  useTrackerCardActions: () => actions,
}));

import { TrackerListRow } from "@/features/integrations/components/TrackerListRow";

function renderRow(tracker: TrackerIntegration) {
  return render(
    <MemoryRouter>
      <TrackerListRow tracker={tracker} reorderControls={<span>reorder-controls</span>} />
    </MemoryRouter>,
  );
}

describe("TrackerListRow", () => {
  beforeEach(() => {
    actions.isSyncing = false;
    actions.handleSync.mockClear();
  });

  it("shows the tracker's identity, stats, status and controls", () => {
    renderRow(buildTracker({ ratio: 2.5, requiredRatio: 1, uploaded: 2048, downloaded: 1024 }));

    expect(screen.getByTestId("tracker-row-title")).toHaveTextContent("Seedpool");
    expect(screen.getByLabelText("Drag to reorder Seedpool")).toBeInTheDocument();
    expect(screen.getByText("reorder-controls")).toBeInTheDocument();
    expect(screen.getByText("2.50")).toHaveClass("text-success");
    expect(screen.getByText("/ 1.00")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
    expect(screen.getByText("1 KB")).toBeInTheDocument();
    expect(screen.getByText("5 min ago")).toHaveAttribute("title", "2026-11-08 10:00:00 GMT-3");
    expect(screen.getByText("success")).toBeInTheDocument();
    expect(screen.getByLabelText("Open Seedpool")).toHaveAttribute("href", "https://seedpool.org/");
  });

  it("uses placeholders for a tracker that never synced", () => {
    renderRow(buildTracker({
      ratio: null,
      requiredRatio: null,
      uploaded: null,
      downloaded: null,
      lastSync: null,
      lastSyncExact: null,
      status: "pending",
      statusLabel: "never synced",
    }));

    expect(screen.getAllByText("--")).toHaveLength(3);
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getByText("never synced")).toBeInTheDocument();
  });

  it("shows an infinite ratio before the first download without flagging it", () => {
    const { container } = renderRow(buildTracker({ ratio: null, requiredRatio: 1, uploaded: 2048, downloaded: 0 }));

    expect(screen.getByText("∞")).toHaveClass("text-success");
    expect(container.firstElementChild).not.toHaveClass("bg-destructive/5");
  });

  it("flags a ratio below the required one", () => {
    const { container } = renderRow(buildTracker({ ratio: 0.5, requiredRatio: 1 }));

    expect(screen.getByLabelText("Ratio warning details")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("bg-destructive/5");
  });

  it("shows why an integration needs fixing and blocks its sync", () => {
    renderRow(buildTracker({ configurationValid: false, configurationError: "Field 'apiKey' is missing." }));

    expect(screen.getByText("needs fixing")).toBeInTheDocument();
    expect(screen.getByText("Field 'apiKey' is missing.")).toBeInTheDocument();
    expect(screen.getByLabelText("Sync now")).toBeDisabled();
  });

  it("falls back to a generic message when the configuration error is unknown", () => {
    renderRow(buildTracker({ configurationValid: false, configurationError: null }));

    expect(screen.getByText("Integration needs fixing")).toBeInTheDocument();
  });

  it("syncs from its compact actions and spins while syncing", () => {
    actions.isSyncing = true;
    renderRow(buildTracker());

    fireEvent.click(screen.getByLabelText("Sync now"));

    expect(actions.handleSync).toHaveBeenCalled();
    expect(screen.getByLabelText("Sync now").querySelector("svg")).toHaveClass("animate-spin");
    expect(screen.queryByText("Syncing...")).not.toBeInTheDocument();
    expect(screen.getByLabelText("View snapshots")).toHaveAttribute("href", "/snapshots?integrationId=tracker-1");
  });
});
