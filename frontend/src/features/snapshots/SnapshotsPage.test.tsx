import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pageTitleSpy = vi.fn();
const formatSnapshotRangeLabelSpy = vi.fn(() => "Formatted Range");
const clearActiveFilterActionSpy = vi.fn();
const setFromSpy = vi.fn();
const setToSpy = vi.fn();
const handleApplyFiltersSpy = vi.fn();
const handleIntegrationChangeSpy = vi.fn();
const handleRangeChangeSpy = vi.fn();
const handleResetFiltersSpy = vi.fn();
const mapIntegrationSpy = vi.fn();
const formatBytesSpy = vi.fn((value: number, unit: string) => `${value}-${unit}`);
const useSnapshotsSpy = vi.fn();

const filtersState = {
  integrationId: "",
  range: "1h" as const,
  from: "2026-01-01T00:00",
  to: "2026-01-01T01:00",
  submittedFilters: { integrationId: "", range: "1h" as const, from: undefined, to: undefined },
  activeFilterAction: null as "apply" | null,
  isFilterTransitionPending: false,
  clearActiveFilterAction: clearActiveFilterActionSpy,
  setFrom: setFromSpy,
  setTo: setToSpy,
  handleApplyFilters: handleApplyFiltersSpy,
  handleIntegrationChange: handleIntegrationChangeSpy,
  handleRangeChange: handleRangeChangeSpy,
  handleResetFilters: handleResetFiltersSpy,
};

const integrationsQuery = {
  data: [] as unknown[],
  isLoading: false,
};

const pluginsQuery = {
  data: [] as unknown[],
  isLoading: false,
};

const snapshotsQuery = {
  data: undefined as unknown,
  isLoading: false,
  isFetching: false,
  error: null as Error | null,
};

vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: unknown) => <a href={to}>{children}</a>,
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => <svg data-testid="icon-arrow-left" />,
  Loader2: () => <svg data-testid="icon-loader" />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, asChild, ...props }: unknown) =>
    asChild ? <span data-testid="button-as-child">{children}</span> : <button type="button" {...props}>{children}</button>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: unknown) => <div>{children}</div>,
  CardHeader: ({ children }: unknown) => <div>{children}</div>,
  CardTitle: ({ children }: unknown) => <h2>{children}</h2>,
  CardContent: ({ children }: unknown) => <div>{children}</div>,
}));

vi.mock("@/layouts/DashboardLayout", () => ({
  DashboardLayout: ({ children }: unknown) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock("@/shared/hooks/use-page-title", () => ({
  usePageTitle: (...args: unknown[]) => pageTitleSpy(...args),
}));

vi.mock("@/features/integrations/hooks", () => ({
  useIntegrations: () => integrationsQuery,
  usePlugins: () => pluginsQuery,
}));

vi.mock("@/features/integrations/types", () => ({
  mapIntegration: (...args: unknown[]) => mapIntegrationSpy(...args),
}));

vi.mock("@/features/snapshots/range", () => ({
  formatSnapshotRangeLabel: (...args: unknown[]) => formatSnapshotRangeLabelSpy(...args),
}));

vi.mock("@/shared/lib/formatters", () => ({
  formatBytes: (...args: unknown[]) => formatBytesSpy(...args),
}));

vi.mock("@/features/snapshots/hooks", () => ({
  useSnapshotFilters: () => filtersState,
  useSnapshots: (...args: unknown[]) => useSnapshotsSpy(...args),
}));

vi.mock("@/features/snapshots/components", () => ({
  SnapshotFiltersCard: (props: unknown) => (
    <div data-testid="filters-card">
      <button type="button" onClick={() => props.onIntegrationChange("integration-2")}>filter-change-integration</button>
      <button type="button" onClick={() => props.onRangeChange("custom")}>filter-change-range</button>
      <button type="button" onClick={() => props.onFromChange("2026-01-01T00:30")}>filter-from</button>
      <button type="button" onClick={() => props.onToChange("2026-01-01T01:30")}>filter-to</button>
      <button type="button" onClick={props.onApply}>filter-apply</button>
      <button type="button" onClick={props.onReset}>filter-reset</button>
      <span>{`busy:${String(props.isBusy)}`}</span>
    </div>
  ),
  SnapshotSummaryCards: ({ count, firstSnapshotLabel, latestSnapshotLabel }: unknown) => (
    <div data-testid="summary-cards">{`${count}|${firstSnapshotLabel}|${latestSnapshotLabel}`}</div>
  ),
  SnapshotLineChartCard: ({ title, yAxisFormatter, tooltipValueFormatter, onToggleSeries, seriesOptions }: unknown) => (
    <div data-testid={`line-chart-card-${title}`}>
      <span>{yAxisFormatter(10)}</span>
      <span>{tooltipValueFormatter(11, seriesOptions[0].key).label}</span>
      <button type="button" onClick={() => onToggleSeries(seriesOptions[0].key, false)}>toggle-{title}</button>
      {title === "Torrent Activity" && (
        <>
          <span>{tooltipValueFormatter(12, "seedingTorrents").label}</span>
          <span>{tooltipValueFormatter(13, "leechingTorrents").label}</span>
          <span>{tooltipValueFormatter(14, "activeTorrents").label}</span>
        </>
      )}
      {title === "Transfer History" && (
        <span>{tooltipValueFormatter(15, "downloadedBytes").label}</span>
      )}
    </div>
  ),
}));

import SnapshotsPage from "@/features/snapshots/SnapshotsPage";

describe("SnapshotsPage", () => {
  it("renders empty-state prompts when no integration is submitted", () => {
    filtersState.integrationId = "";
    filtersState.submittedFilters = { integrationId: "", range: "1h", from: undefined, to: undefined };
    filtersState.range = "1h";
    filtersState.activeFilterAction = null;
    filtersState.isFilterTransitionPending = false;
    integrationsQuery.data = [];
    integrationsQuery.isLoading = false;
    pluginsQuery.data = [];
    pluginsQuery.isLoading = false;
    snapshotsQuery.data = undefined;
    snapshotsQuery.isLoading = false;
    snapshotsQuery.isFetching = false;
    snapshotsQuery.error = null;
    useSnapshotsSpy.mockReturnValue(snapshotsQuery);
    mapIntegrationSpy.mockReset();

    render(<SnapshotsPage />);

    expect(pageTitleSpy).toHaveBeenCalledWith("TrackArr | Snapshots");
    expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();
    expect(screen.getByText("Choose an integration and select a time range to view snapshots.")).toBeInTheDocument();
    expect(screen.getByText("Select an integration to load snapshot data.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("filter-change-integration"));
    fireEvent.click(screen.getByText("filter-change-range"));
    fireEvent.click(screen.getByText("filter-from"));
    fireEvent.click(screen.getByText("filter-to"));
    fireEvent.click(screen.getByText("filter-apply"));
    fireEvent.click(screen.getByText("filter-reset"));

    expect(handleIntegrationChangeSpy).toHaveBeenCalledWith("integration-2");
    expect(handleRangeChangeSpy).toHaveBeenCalledWith("custom");
    expect(setFromSpy).toHaveBeenCalledWith("2026-01-01T00:30");
    expect(setToSpy).toHaveBeenCalledWith("2026-01-01T01:30");
    expect(handleApplyFiltersSpy).toHaveBeenCalled();
    expect(handleResetFiltersSpy).toHaveBeenCalled();
    expect(clearActiveFilterActionSpy).toHaveBeenCalled();
    expect(useSnapshotsSpy).toHaveBeenCalledWith(
      {
        integrationId: "",
        range: "1h",
        from: undefined,
        to: undefined,
      },
      false,
    );
  });

  it("covers loading, error, no-data, and data chart states", () => {
    const expectedFromIso = new Date("2026-01-01T00:00").toISOString();
    const expectedToIso = new Date("2026-01-01T01:00").toISOString();

    filtersState.integrationId = "integration-1";
    filtersState.range = "custom";
    filtersState.from = "2026-01-01T00:00";
    filtersState.to = "2026-01-01T01:00";
    filtersState.submittedFilters = {
      integrationId: "integration-1",
      range: "custom",
      from: "2026-01-01T00:00",
      to: "2026-01-01T01:00",
    };
    filtersState.activeFilterAction = "apply";
    filtersState.isFilterTransitionPending = true;

    integrationsQuery.data = [{ id: "integration-1", pluginId: "plugin-a" }];
    integrationsQuery.isLoading = false;
    pluginsQuery.data = [{ pluginId: "plugin-a", displayName: "Plugin A" }];
    pluginsQuery.isLoading = false;
    mapIntegrationSpy.mockImplementation(() => ({
      id: "integration-1",
      name: "Tracker One",
      byteUnitSystem: "decimal",
    }));

    snapshotsQuery.isLoading = true;
    snapshotsQuery.isFetching = true;
    snapshotsQuery.error = null;
    snapshotsQuery.data = undefined;
    useSnapshotsSpy.mockReturnValue(snapshotsQuery);

    const { rerender } = render(<SnapshotsPage />);
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();
    expect(screen.getByText("busy:true")).toBeInTheDocument();
    expect(useSnapshotsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        integrationId: "integration-1",
        range: "custom",
        from: expectedFromIso,
        to: expectedToIso,
      }),
      true,
    );

    snapshotsQuery.isLoading = false;
    snapshotsQuery.isFetching = false;
    snapshotsQuery.error = new Error("boom");
    rerender(<SnapshotsPage />);
    expect(screen.getByText("Failed to load snapshots: boom")).toBeInTheDocument();

    snapshotsQuery.error = null;
    snapshotsQuery.data = { items: [] };
    rerender(<SnapshotsPage />);
    expect(screen.getByText("No snapshot data was found for this integration in the selected time range.")).toBeInTheDocument();

    snapshotsQuery.data = {
      items: [
        {
          capturedAt: "2026-01-01T00:00:00.000Z",
          uploadedBytes: null,
          downloadedBytes: 20,
          ratio: null,
          seedingTorrents: null,
          leechingTorrents: 2,
          activeTorrents: 3,
        },
        {
          capturedAt: "2026-01-01T00:30:00.000Z",
          uploadedBytes: 10,
          downloadedBytes: null,
          ratio: 1.25,
          seedingTorrents: 4,
          leechingTorrents: null,
          activeTorrents: null,
        },
      ],
    };
    rerender(<SnapshotsPage />);

    expect(formatSnapshotRangeLabelSpy).toHaveBeenCalledWith("custom", "2026-01-01T00:00", "2026-01-01T01:00");
    expect(screen.getByTestId("summary-cards")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart-card-Transfer History")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart-card-Ratio History")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart-card-Torrent Activity")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Dashboard/i })).toHaveAttribute("href", "/");
    expect(formatBytesSpy).toHaveBeenCalledWith(10, "decimal");

    fireEvent.click(screen.getByText("toggle-Transfer History"));
    fireEvent.click(screen.getByText("toggle-Ratio History"));
    fireEvent.click(screen.getByText("toggle-Torrent Activity"));
  });
});

