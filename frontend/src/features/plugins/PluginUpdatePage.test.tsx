import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import PluginUpdatePage from "@/features/plugins/PluginUpdatePage";
import { useDeletePluginOverride, usePluginCatalog, usePluginDiff } from "@/features/plugins/hooks";
import type { ApiPluginDiff, ApiPluginListItem } from "@/features/plugins/types";
import { usePageTitle } from "@/shared/hooks/use-page-title";

vi.mock("@monaco-editor/react", () => ({
  DiffEditor: ({ original, modified }: { original: string; modified: string }) => (
    <div data-testid="diff-editor" data-original={original} data-modified={modified} />
  ),
}));

vi.mock("@/layouts/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock("@/shared/hooks/use-page-title", () => ({ usePageTitle: vi.fn() }));

vi.mock("@/features/plugins/hooks", () => ({
  usePluginCatalog: vi.fn(),
  usePluginDiff: vi.fn(),
  useDeletePluginOverride: vi.fn(),
}));

vi.mock("@/features/plugins/components/PluginTestButton", () => ({
  PluginTestButton: ({
    label,
    pluginId,
    pluginName,
    source,
    disabledReason,
  }: {
    label: string;
    pluginId: string | null;
    pluginName: string;
    source: unknown;
    disabledReason?: string | null;
  }) => (
    <button
      type="button"
      data-testid="plugin-test-button"
      data-plugin-id={pluginId ?? ""}
      data-plugin-name={pluginName}
      data-source={JSON.stringify(source)}
      data-disabled-reason={disabledReason ?? ""}
    >
      {label}
    </button>
  ),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const outdatedPlugin: ApiPluginListItem = {
  pluginId: "seedpool",
  displayName: "Seedpool",
  definitionValid: true,
  definitionError: null,
  dashboard: null,
  baseUrls: [],
  fields: [],
  customFields: [],
  origin: "override",
  version: "1.0.0",
  baseVersion: "1.0.0",
  latestOfficialVersion: "1.1.0",
  outdated: true,
  orphan: false,
  deprecated: false,
  incompatible: false,
  incompatibleVersion: null,
  requiredSchemaVersion: null,
  requiredAppVersion: null,
  incompatibleMessage: null,
  hiddenOfficial: false,
  lastSyncFailed: false,
};

const diff: ApiPluginDiff = {
  pluginId: "seedpool",
  origin: "override",
  baseVersion: "1.0.0",
  latestOfficialVersion: "1.1.0",
  base: "base yaml",
  yours: "your yaml",
  latestOfficial: "official yaml",
  changelog: [{ version: "1.1.0", date: "2026-11-08", notes: "Read the new stats page." }],
};

let catalogState: { data?: ApiPluginListItem[]; isLoading: boolean; error: Error | null };
let diffState: { data?: ApiPluginDiff; isLoading: boolean; error: Error | null };
let deleteMutation: { mutate: ReturnType<typeof vi.fn>; isPending: boolean };

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderPage(pluginId = "seedpool") {
  return render(
    <MemoryRouter initialEntries={[`/plugins/${pluginId}/update`]}>
      <Routes>
        <Route path="/plugins/:pluginId/update" element={<PluginUpdatePage />} />
        <Route path="/plugins" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  catalogState = { data: [outdatedPlugin], isLoading: false, error: null };
  diffState = { data: diff, isLoading: false, error: null };
  deleteMutation = { mutate: vi.fn(), isPending: false };
  vi.mocked(usePageTitle).mockReset();
  vi.mocked(usePluginCatalog).mockImplementation(() => catalogState as never);
  vi.mocked(usePluginDiff).mockImplementation(() => diffState as never);
  vi.mocked(useDeletePluginOverride).mockImplementation(() => deleteMutation as never);
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

describe("PluginUpdatePage", () => {
  it("shows the warning, the changelog since the base and both diffs", () => {
    renderPage();

    expect(usePageTitle).toHaveBeenCalledWith("TrackArr | Review Seedpool update");
    expect(usePluginDiff).toHaveBeenCalledWith("seedpool", true);
    expect(screen.getByText("Review Seedpool update")).toBeInTheDocument();
    expect(screen.getByTestId("plugin-badge-outdated")).toHaveTextContent("Outdated (official v1.1.0)");

    const warning = screen.getByTestId("outdated-override-warning");
    expect(warning).toHaveAttribute("data-highlighted", "false");
    expect(warning).toHaveTextContent("A newer official version v1.1.0 is available. Your edited copy is based on v1.0.0.");
    expect(screen.getByRole("button", { name: "Use official" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Keep mine" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Test official/ })).toBeNull();

    const changelog = screen.getByTestId("plugin-changelog");
    expect(changelog).toHaveTextContent("Official changes since v1.0.0");
    expect(changelog).toHaveTextContent("v1.1.0");
    expect(changelog).toHaveTextContent("Read the new stats page.");

    const yours = screen.getByTestId("diff-yours");
    expect(yours).toHaveTextContent("What you changed");
    expect(yours.querySelector("[data-testid='diff-editor']")).toHaveAttribute("data-original", "base yaml");
    expect(yours.querySelector("[data-testid='diff-editor']")).toHaveAttribute("data-modified", "your yaml");

    const upstream = screen.getByTestId("diff-upstream");
    expect(upstream).toHaveTextContent("What changed upstream");
    expect(upstream).toHaveTextContent("Official v1.0.0 against official v1.1.0.");
    expect(upstream.querySelector("[data-testid='diff-editor']")).toHaveAttribute("data-original", "base yaml");
    expect(upstream.querySelector("[data-testid='diff-editor']")).toHaveAttribute("data-modified", "official yaml");
  });

  it("highlights the warning and offers Test official when the last sync failed", () => {
    catalogState.data = [{ ...outdatedPlugin, lastSyncFailed: true }];
    renderPage();

    const warning = screen.getByTestId("outdated-override-warning");
    expect(warning).toHaveAttribute("data-highlighted", "true");
    expect(warning).toHaveClass("text-destructive");
    expect(warning).toHaveTextContent("The last sync of an integration using your copy failed.");
    const testButton = screen.getByRole("button", { name: "Test official" });
    expect(testButton).toHaveAttribute("data-plugin-id", "seedpool");
    expect(testButton).toHaveAttribute("data-plugin-name", "Seedpool");
    expect(testButton).toHaveAttribute("data-source", JSON.stringify({ useOfficial: true }));
  });

  it("Use official asks for confirmation, deletes the override and returns to the plugin", async () => {
    deleteMutation.mutate.mockImplementation((_id: string, options?: { onSuccess?: () => void }) => options?.onSuccess?.());
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Use official" }));
    expect(deleteMutation.mutate).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Your override is deleted with no backup");
    fireEvent.click(screen.getByRole("button", { name: "Delete my override" }));

    expect(deleteMutation.mutate).toHaveBeenCalledWith("seedpool", expect.anything());
    expect(toast.success).toHaveBeenCalledWith("Seedpool now uses the official version.");
    expect(screen.getByTestId("location")).toHaveTextContent("/plugins?plugin=seedpool");
  });

  it("cancelling the confirmation deletes nothing", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Use official" }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deleteMutation.mutate).not.toHaveBeenCalled();
    expect(screen.getByTestId("outdated-override-warning")).toBeInTheDocument();
  });

  it("reports a failed Use official and stays on the page", async () => {
    deleteMutation.mutate.mockImplementation((_id: string, options?: { onError?: (error: Error) => void }) =>
      options?.onError?.(new Error("disk is read-only")),
    );
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Use official" }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Delete my override" }));

    expect(toast.error).toHaveBeenCalledWith("Use official failed: disk is read-only");
    expect(screen.queryByTestId("location")).toBeNull();
  });

  it("disables the actions while the override is being deleted", () => {
    deleteMutation.isPending = true;
    renderPage();

    expect(screen.getByRole("button", { name: "Use official" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep mine" })).toBeDisabled();
  });

  it("Keep mine closes the page and changes nothing", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Keep mine" }));

    expect(deleteMutation.mutate).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/plugins?plugin=seedpool");
  });

  it("explains a missing base copy and an empty changelog", () => {
    diffState.data = { ...diff, base: null, baseVersion: null, changelog: [] };
    renderPage();

    expect(screen.getByTestId("plugin-changelog")).toHaveTextContent("Official changes since your base");
    expect(screen.getByText("The official plugin lists no changelog entries for these versions.")).toBeInTheDocument();
    expect(screen.queryByTestId("diff-editor")).toBeNull();
    expect(screen.getAllByText(/is not on disk yet/)).toHaveLength(2);
  });

  it("explains a missing compared file", () => {
    diffState.data = { ...diff, latestOfficial: null, latestOfficialVersion: null };
    renderPage();

    expect(screen.getByTestId("diff-upstream")).toHaveTextContent("The file to compare is not on disk.");
    expect(screen.getByTestId("diff-upstream")).toHaveTextContent("Official v1.0.0 against official v?.");
    expect(screen.getByTestId("diff-yours").querySelector("[data-testid='diff-editor']")).not.toBeNull();
  });

  it("shows the diff loading and error states", () => {
    diffState = { data: undefined, isLoading: true, error: null };
    const { unmount } = renderPage();
    expect(screen.queryByTestId("diff-yours")).toBeNull();
    unmount();

    diffState = { data: undefined, isLoading: false, error: new Error("diff down") };
    renderPage();
    expect(screen.getByText("Failed to load the plugin diff: diff down")).toBeInTheDocument();
  });

  it("shows the catalog loading and error states", () => {
    catalogState = { data: undefined, isLoading: true, error: null };
    const { unmount } = renderPage();
    expect(screen.queryByTestId("outdated-override-warning")).toBeNull();
    expect(usePluginDiff).toHaveBeenCalledWith("seedpool", false);
    unmount();

    catalogState = { data: undefined, isLoading: false, error: new Error("catalog down") };
    renderPage();
    expect(screen.getByText("Failed to load plugins: catalog down")).toBeInTheDocument();
  });

  it("explains a plugin that is not outdated or does not exist", () => {
    catalogState.data = [{ ...outdatedPlugin, outdated: false }];
    const { unmount } = renderPage();
    expect(screen.getByText(/Seedpool has no outdated override/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to plugins" })).toHaveAttribute("href", "/plugins?plugin=seedpool");
    expect(usePluginDiff).toHaveBeenCalledWith("seedpool", false);
    unmount();

    renderPage("unknown");
    expect(screen.getByText(/Plugin unknown was not found/)).toBeInTheDocument();
  });
});
