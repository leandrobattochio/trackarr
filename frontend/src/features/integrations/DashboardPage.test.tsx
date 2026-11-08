import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DASHBOARD_VIEW_MODE_STORAGE_KEY } from "@/features/integrations/dashboard-view-mode";
import type { DashboardViewMode } from "@/features/integrations/dashboard-view-mode";
import type { TrackerCollectionProps } from "@/features/integrations/components/tracker-collection";

const pageTitleSpy = vi.fn();

const integrationsQuery = {
  data: [] as unknown[],
  isLoading: false,
  error: null as Error | null,
};

const pluginsQuery = {
  data: [] as unknown[],
  isLoading: false,
};

const orderState = { orderedIntegrations: [] as unknown[] };

vi.mock("lucide-react", () => ({
  Loader2: () => <svg data-testid="icon-loader" />,
  AlertCircle: () => <svg data-testid="icon-alert-circle" />,
}));

vi.mock("@/layouts/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock("@/features/integrations/components/TrackerCardGrid", () => ({
  TrackerCardGrid: ({ order }: TrackerCollectionProps) => <div>{`cards:${order.orderedIntegrations.length}`}</div>,
}));

vi.mock("@/features/integrations/components/TrackerList", () => ({
  TrackerList: ({ order }: TrackerCollectionProps) => <div>{`list:${order.orderedIntegrations.length}`}</div>,
}));

vi.mock("@/features/integrations/components/DashboardViewToggle", () => ({
  DashboardViewToggle: ({ value, onChange }: { value: DashboardViewMode; onChange: (mode: DashboardViewMode) => void }) => (
    <div>
      <span>{`view:${value}`}</span>
      <button type="button" onClick={() => onChange("list")}>show-list</button>
      <button type="button" onClick={() => onChange("cards")}>show-cards</button>
    </div>
  ),
}));

vi.mock("@/features/integrations/components/StatsOverview", () => ({
  StatsOverview: ({ integrations }: { integrations: unknown[] }) => <div>{`stats-count:${integrations.length}`}</div>,
}));

vi.mock("@/features/integrations/components/AddIntegrationDialog", () => ({
  AddIntegrationDialog: ({ addedPluginIds }: { addedPluginIds: string[] }) => <div>{`add-dialog:${addedPluginIds.join(",")}`}</div>,
}));

vi.mock("@/features/integrations/dashboard-order", () => ({
  useDashboardCardOrder: () => orderState,
}));

vi.mock("@/features/integrations/hooks", () => ({
  useIntegrations: () => integrationsQuery,
  usePlugins: () => pluginsQuery,
}));

vi.mock("@/features/integrations/types", () => ({
  mapIntegration: (raw: { id: string; pluginId: string }) => ({ id: raw.id, pluginId: raw.pluginId, name: raw.id }),
}));

vi.mock("@/shared/hooks/use-page-title", () => ({
  usePageTitle: (...args: unknown[]) => pageTitleSpy(...args),
}));

import DashboardPage from "@/features/integrations/DashboardPage";

function withIntegrations() {
  integrationsQuery.data = [{ id: "int-1", pluginId: "p1" }, { id: "int-2", pluginId: "p2" }];
  orderState.orderedIntegrations = integrationsQuery.data;
}

describe("DashboardPage", () => {
  afterEach(() => {
    window.localStorage.clear();
    integrationsQuery.data = [];
    integrationsQuery.isLoading = false;
    integrationsQuery.error = null;
    pluginsQuery.isLoading = false;
    orderState.orderedIntegrations = [];
  });

  it("renders loading and error states", () => {
    integrationsQuery.isLoading = true;

    const { rerender } = render(<DashboardPage />);
    expect(pageTitleSpy).toHaveBeenCalledWith("TrackArr | Dashboard");
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();

    integrationsQuery.isLoading = false;
    integrationsQuery.error = new Error("api down");
    rerender(<DashboardPage />);

    expect(screen.getByText("Failed to load integrations: api down")).toBeInTheDocument();
  });

  it("renders the empty state when no integrations exist", () => {
    render(<DashboardPage />);

    expect(screen.getByText("No integrations yet. Add a tracker to get started.")).toBeInTheDocument();
    expect(screen.getByText("stats-count:0")).toBeInTheDocument();
    expect(screen.getByText("add-dialog:")).toBeInTheDocument();
    expect(screen.queryByText(/^cards:/)).not.toBeInTheDocument();
  });

  it("shows the trackers as cards by default", () => {
    withIntegrations();

    render(<DashboardPage />);

    expect(screen.getByText("view:cards")).toBeInTheDocument();
    expect(screen.getByText("cards:2")).toBeInTheDocument();
    expect(screen.getByText("add-dialog:p1,p2")).toBeInTheDocument();
  });

  it("switches between cards and list, and remembers the choice", () => {
    withIntegrations();

    const { unmount } = render(<DashboardPage />);
    fireEvent.click(screen.getByText("show-list"));

    expect(screen.getByText("list:2")).toBeInTheDocument();
    expect(screen.queryByText("cards:2")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(DASHBOARD_VIEW_MODE_STORAGE_KEY)).toBe(JSON.stringify("list"));

    unmount();
    render(<DashboardPage />);
    expect(screen.getByText("view:list")).toBeInTheDocument();

    fireEvent.click(screen.getByText("show-cards"));
    expect(screen.getByText("cards:2")).toBeInTheDocument();
  });
});
