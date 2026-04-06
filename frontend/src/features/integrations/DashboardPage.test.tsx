import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pageTitleSpy = vi.fn();
const mapIntegrationSpy = vi.fn();
const moveCardSpy = vi.fn();
const dragStartSpy = vi.fn();
const dragOverSpy = vi.fn();
const dropSpy = vi.fn();
const dragEndSpy = vi.fn();

const integrationsQuery = {
  data: [] as any[],
  isLoading: false,
  error: null as Error | null,
};

const pluginsQuery = {
  data: [] as any[],
  isLoading: false,
};

const orderState = {
  orderedIntegrations: [] as any[],
  draggedCardId: null as string | null,
  dropTargetCardId: null as string | null,
  handleCardDragStart: (id: string) => dragStartSpy(id),
  handleCardDragOver: (event: any, id: string) => dragOverSpy(event, id),
  handleCardDrop: (targetId: string, sourceId?: string) => dropSpy(targetId, sourceId),
  handleCardDragEnd: () => dragEndSpy(),
  moveCard: (id: string, direction: -1 | 1) => moveCardSpy(id, direction),
};

vi.mock("lucide-react", () => ({
  ArrowDown: () => <svg data-testid="icon-down" />,
  ArrowUp: () => <svg data-testid="icon-up" />,
  Loader2: () => <svg data-testid="icon-loader" />,
  AlertCircle: () => <svg data-testid="icon-alert-circle" />,
}));

vi.mock("@/layouts/DashboardLayout", () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock("@/features/integrations/components/TrackerCard", () => ({
  TrackerCard: ({ tracker, reorderControls }: any) => (
    <div data-testid="tracker-card-inner">
      <span>{tracker.name}</span>
      {reorderControls}
    </div>
  ),
}));

vi.mock("@/features/integrations/components/StatsOverview", () => ({
  StatsOverview: ({ integrations }: any) => <div>{`stats-count:${integrations.length}`}</div>,
}));

vi.mock("@/features/integrations/components/AddIntegrationDialog", () => ({
  AddIntegrationDialog: ({ addedPluginIds }: any) => <div>{`add-dialog:${addedPluginIds.join(",")}`}</div>,
}));

vi.mock("@/features/integrations/dashboard-order", () => ({
  useDashboardCardOrder: () => orderState,
}));

vi.mock("@/features/integrations/hooks", () => ({
  useIntegrations: () => integrationsQuery,
  usePlugins: () => pluginsQuery,
}));

vi.mock("@/features/integrations/types", () => ({
  mapIntegration: (...args: any[]) => mapIntegrationSpy(...args),
}));

vi.mock("@/shared/hooks/use-page-title", () => ({
  usePageTitle: (...args: any[]) => pageTitleSpy(...args),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, onMouseDown, disabled, ...props }: any) => (
    <button type="button" onClick={onClick} onMouseDown={onMouseDown} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

import DashboardPage from "@/features/integrations/DashboardPage";

describe("DashboardPage", () => {
  it("renders loading and error states", () => {
    integrationsQuery.data = [];
    integrationsQuery.isLoading = true;
    integrationsQuery.error = null;
    pluginsQuery.isLoading = false;
    orderState.orderedIntegrations = [];

    const { rerender } = render(<DashboardPage />);
    expect(pageTitleSpy).toHaveBeenCalledWith("TrackArr | Dashboard");
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();

    integrationsQuery.isLoading = false;
    integrationsQuery.error = new Error("api down");
    rerender(<DashboardPage />);

    expect(screen.getByText("Failed to load integrations: api down")).toBeInTheDocument();
  });

  it("renders empty dashboard state when no integrations exist", () => {
    integrationsQuery.data = [];
    integrationsQuery.isLoading = false;
    integrationsQuery.error = null;
    pluginsQuery.data = [];
    pluginsQuery.isLoading = false;
    orderState.orderedIntegrations = [];

    render(<DashboardPage />);

    expect(screen.getByText("No integrations yet. Add a tracker to get started.")).toBeInTheDocument();
    expect(screen.getByText("stats-count:0")).toBeInTheDocument();
    expect(screen.getByText("add-dialog:")).toBeInTheDocument();
  });

  it("renders ordered cards and handles drag/drop and move controls", () => {
    integrationsQuery.data = [{ id: "int-1", pluginId: "p1" }, { id: "int-2", pluginId: "p2" }];
    integrationsQuery.error = null;
    integrationsQuery.isLoading = false;
    pluginsQuery.data = [{ pluginId: "p1" }, { pluginId: "p2" }];
    pluginsQuery.isLoading = false;

    mapIntegrationSpy.mockImplementation((raw: any) => ({
      id: raw.id,
      pluginId: raw.pluginId,
      name: raw.id === "int-1" ? "First Tracker" : "Second Tracker",
    }));

    orderState.orderedIntegrations = [
      { id: "int-1", pluginId: "p1", name: "First Tracker" },
      { id: "int-2", pluginId: "p2", name: "Second Tracker" },
    ];
    orderState.draggedCardId = "int-1";
    orderState.dropTargetCardId = "int-2";

    render(<DashboardPage />);

    expect(screen.getByTestId("dashboard-cards-grid")).toBeInTheDocument();
    expect(screen.getAllByTestId("tracker-card")).toHaveLength(2);
    expect(screen.getByText("add-dialog:p1,p2")).toBeInTheDocument();
    expect(screen.getByLabelText("Move First Tracker up")).toBeDisabled();
    expect(screen.getByLabelText("Move Second Tracker down")).toBeDisabled();

    const card = screen.getAllByTestId("tracker-card")[0];
    const fakeDataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
      getData: vi.fn(() => "int-1"),
    };

    fireEvent.dragStart(card, { dataTransfer: fakeDataTransfer });
    fireEvent.dragOver(card, { dataTransfer: fakeDataTransfer });
    fireEvent.drop(card, { dataTransfer: fakeDataTransfer });
    fireEvent.dragEnd(card);

    fireEvent.mouseDown(screen.getByLabelText("Move Second Tracker up"));
    fireEvent.mouseDown(screen.getByLabelText("Move First Tracker down"));
    fireEvent.click(screen.getByLabelText("Move Second Tracker up"));
    fireEvent.click(screen.getByLabelText("Move First Tracker down"));

    expect(fakeDataTransfer.setData).toHaveBeenCalledWith("text/plain", "int-1");
    expect(dragStartSpy).toHaveBeenCalledWith("int-1");
    expect(dragOverSpy).toHaveBeenCalled();
    expect(dropSpy).toHaveBeenCalledWith("int-1", "int-1");
    expect(dragEndSpy).toHaveBeenCalled();
    expect(moveCardSpy).toHaveBeenCalledWith("int-2", -1);
    expect(moveCardSpy).toHaveBeenCalledWith("int-1", 1);
  });
});
