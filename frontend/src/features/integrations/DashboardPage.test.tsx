import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pageTitleSpy = vi.fn();
const mapIntegrationSpy = vi.fn();
const dragStartSpy = vi.fn();
const dragOverSpy = vi.fn();
const dropSpy = vi.fn();
const dragEndSpy = vi.fn();

const integrationsQuery = {
  data: [] as unknown[],
  isLoading: false,
  error: null as Error | null,
};

const pluginsQuery = {
  data: [] as unknown[],
  isLoading: false,
};

const orderState = {
  orderedIntegrations: [] as unknown[],
  draggedCardId: null as string | null,
  dropTargetCardId: null as string | null,
  handleCardDragStart: (id: string) => dragStartSpy(id),
  handleCardDragOver: (event: unknown, id: string) => dragOverSpy(event, id),
  handleCardDrop: (targetId: string, sourceId?: string) => dropSpy(targetId, sourceId),
  handleCardDragEnd: () => dragEndSpy(),
};

vi.mock("lucide-react", () => ({
  AlertCircle: () => <svg data-testid="icon-alert-circle" />,
  Lock: () => <svg data-testid="icon-lock" />,
  Loader2: () => <svg data-testid="icon-loader" />,
  Unlock: () => <svg data-testid="icon-unlock" />,
}));

vi.mock("@/layouts/DashboardLayout", () => ({
  DashboardLayout: ({ children }: unknown) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock("@/features/integrations/components/TrackerCard", () => ({
  TrackerCard: ({ tracker }: unknown) => (
    <div data-testid="tracker-card-inner">
      <span>{tracker.name}</span>
    </div>
  ),
}));

vi.mock("@/features/integrations/components/StatsOverview", () => ({
  StatsOverview: ({ integrations }: unknown) => <div>{`stats-count:${integrations.length}`}</div>,
}));

vi.mock("@/features/integrations/components/AddIntegrationDialog", () => ({
  AddIntegrationDialog: ({ addedPluginIds }: unknown) => <div>{`add-dialog:${addedPluginIds.join(",")}`}</div>,
}));

vi.mock("@/features/integrations/dashboard-order", () => ({
  useDashboardCardOrder: () => orderState,
}));

vi.mock("@/features/integrations/hooks", () => ({
  useIntegrations: () => integrationsQuery,
  usePlugins: () => pluginsQuery,
}));

vi.mock("@/features/integrations/types", () => ({
  mapIntegration: (...args: unknown[]) => mapIntegrationSpy(...args),
}));

vi.mock("@/shared/hooks/use-page-title", () => ({
  usePageTitle: (...args: unknown[]) => pageTitleSpy(...args),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, "aria-label": ariaLabel, "data-testid": testId, "aria-pressed": ariaPressed, disabled, className }: unknown) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={testId}
      aria-pressed={ariaPressed}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: unknown) => <>{children}</>,
  TooltipContent: ({ children, "data-testid": testId }: unknown) => (
    <div data-testid={testId ?? "tooltip-content"}>{children}</div>
  ),
  TooltipProvider: ({ children }: unknown) => <>{children}</>,
  TooltipTrigger: ({ children }: unknown) => <>{children}</>,
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

  it("renders drag lock toggle defaulting to locked state with tooltip", () => {
    integrationsQuery.data = [];
    integrationsQuery.isLoading = false;
    integrationsQuery.error = null;
    orderState.orderedIntegrations = [];

    render(<DashboardPage />);

    const lockBtn = screen.getByTestId("drag-lock-toggle");
    expect(lockBtn).toBeInTheDocument();
    expect(lockBtn).toHaveAttribute("aria-label", "Unlock card reordering");
    expect(lockBtn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("icon-lock")).toBeInTheDocument();
    expect(screen.getByTestId("drag-lock-tooltip")).toHaveTextContent("Unlock to reorder cards");
  });

  it("toggles drag lock state and updates icon and tooltip on click", () => {
    integrationsQuery.data = [];
    integrationsQuery.isLoading = false;
    integrationsQuery.error = null;
    orderState.orderedIntegrations = [];

    render(<DashboardPage />);

    const lockBtn = screen.getByTestId("drag-lock-toggle");

    expect(screen.getByTestId("icon-lock")).toBeInTheDocument();
    expect(screen.getByTestId("drag-lock-tooltip")).toHaveTextContent("Unlock to reorder cards");

    fireEvent.click(lockBtn);

    expect(screen.queryByTestId("icon-lock")).not.toBeInTheDocument();
    expect(screen.getByTestId("icon-unlock")).toBeInTheDocument();
    expect(lockBtn).toHaveAttribute("aria-label", "Lock card reordering");
    expect(lockBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("drag-lock-tooltip")).toHaveTextContent("Lock card order");

    fireEvent.click(lockBtn);

    expect(screen.getByTestId("icon-lock")).toBeInTheDocument();
    expect(lockBtn).toHaveAttribute("aria-label", "Unlock card reordering");
    expect(lockBtn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("drag-lock-tooltip")).toHaveTextContent("Unlock to reorder cards");
  });

  it("updates subtitle text to reflect edit mode without layout shift", () => {
    integrationsQuery.data = [];
    integrationsQuery.isLoading = false;
    integrationsQuery.error = null;
    orderState.orderedIntegrations = [];

    render(<DashboardPage />);

    const subtitle = screen.getByTestId("dashboard-subtitle");
    expect(subtitle).toHaveTextContent("Monitor your private tracker ratios");

    fireEvent.click(screen.getByTestId("drag-lock-toggle"));

    expect(subtitle).toHaveTextContent("Edit mode — drag cards to reorder");

    fireEvent.click(screen.getByTestId("drag-lock-toggle"));

    expect(subtitle).toHaveTextContent("Monitor your private tracker ratios");
  });

  it("does not call drag handlers and omits draggable attribute when locked", () => {
    dragStartSpy.mockClear();
    dragOverSpy.mockClear();
    dropSpy.mockClear();
    dragEndSpy.mockClear();

    integrationsQuery.data = [{ id: "int-1", pluginId: "p1" }];
    integrationsQuery.error = null;
    integrationsQuery.isLoading = false;
    pluginsQuery.data = [{ pluginId: "p1" }];
    pluginsQuery.isLoading = false;
    mapIntegrationSpy.mockImplementation((raw: unknown) => ({ id: raw.id, pluginId: raw.pluginId, name: "First" }));
    orderState.orderedIntegrations = [{ id: "int-1", pluginId: "p1", name: "First" }];
    orderState.draggedCardId = null;
    orderState.dropTargetCardId = null;

    render(<DashboardPage />);

    const card = screen.getByTestId("tracker-card");
    expect(card).not.toHaveAttribute("draggable", "true");
    expect(card).toHaveAttribute("data-drag-locked");

    const fakeDataTransfer = { effectAllowed: "", dropEffect: "", setData: vi.fn(), getData: vi.fn(() => "int-1") };
    fireEvent.dragStart(card, { dataTransfer: fakeDataTransfer });
    fireEvent.dragOver(card, { dataTransfer: fakeDataTransfer });
    fireEvent.drop(card, { dataTransfer: fakeDataTransfer });
    fireEvent.dragEnd(card);

    expect(dragStartSpy).not.toHaveBeenCalled();
    expect(dragOverSpy).not.toHaveBeenCalled();
    expect(dropSpy).not.toHaveBeenCalled();
    expect(dragEndSpy).not.toHaveBeenCalled();
  });

  it("renders ordered cards and handles drag/drop events when unlocked", () => {
    dragStartSpy.mockClear();
    dragOverSpy.mockClear();
    dropSpy.mockClear();
    dragEndSpy.mockClear();

    integrationsQuery.data = [{ id: "int-1", pluginId: "p1" }, { id: "int-2", pluginId: "p2" }];
    integrationsQuery.error = null;
    integrationsQuery.isLoading = false;
    pluginsQuery.data = [{ pluginId: "p1" }, { pluginId: "p2" }];
    pluginsQuery.isLoading = false;

    mapIntegrationSpy.mockImplementation((raw: unknown) => ({
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

    fireEvent.click(screen.getByTestId("drag-lock-toggle"));

    const card = screen.getAllByTestId("tracker-card")[0];
    expect(card).toHaveAttribute("draggable", "true");
    expect(card).not.toHaveAttribute("data-drag-locked");

    const grid = screen.getByTestId("dashboard-cards-grid");
    expect(grid.className).toContain("ring-2");

    const lockBtn = screen.getByTestId("drag-lock-toggle");
    expect(lockBtn.className).toContain("border-destructive/60");

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

    expect(fakeDataTransfer.setData).toHaveBeenCalledWith("text/plain", "int-1");
    expect(dragStartSpy).toHaveBeenCalledWith("int-1");
    expect(dragOverSpy).toHaveBeenCalled();
    expect(dropSpy).toHaveBeenCalledWith("int-1", "int-1");
    expect(dragEndSpy).toHaveBeenCalled();
  });
});
