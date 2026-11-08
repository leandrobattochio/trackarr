import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePluginCatalog } from "@/features/plugins/hooks";
import { WhatsNewDialog } from "@/features/whats-new/components/WhatsNewDialog";
import { appReport, whatsNewReport } from "@/features/whats-new/test-data";
import type { ApiWhatsNew } from "@/features/whats-new/types";

vi.mock("@/features/plugins/hooks", () => ({ usePluginCatalog: vi.fn() }));

const release040 = { version: "0.4.0", tagName: "v0.4.0", name: "v0.4.0", url: "https://example.test/v0.4.0", publishedAt: "2026-11-07T12:00:00Z", notes: "### Breaking\r\n- Plugins moved" };
const release050 = { ...release040, version: "0.5.0", tagName: "v0.5.0", url: "https://example.test/v0.5.0", publishedAt: null, notes: "  " };

beforeEach(() => {
  vi.mocked(usePluginCatalog).mockReturnValue({ data: [{ pluginId: "seedpool", displayName: "Seedpool" }] } as never);
});

function renderDialog(props: Partial<Parameters<typeof WhatsNewDialog>[0]> = {}) {
  const onOpenChange = vi.fn();
  render(<WhatsNewDialog open onOpenChange={onOpenChange} report={whatsNewReport()} isLoading={false} error={null} {...props} />);
  return { onOpenChange };
}

function withUpdates(overrides: Partial<ApiWhatsNew> = {}) {
  return whatsNewReport({
    app: appReport({ releases: [release050, release040] }),
    pluginUpdates: [
      {
        id: 2,
        pluginId: "seedpool",
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        appliedAt: "2026-11-07T10:00:00Z",
        changelog: [{ version: "1.1.0", date: "2026-11-06", notes: "New buffer metric" }],
      },
      { id: 1, pluginId: "asc", fromVersion: null, toVersion: "1.0.0", appliedAt: "2026-11-07T10:00:00Z", changelog: [] },
    ],
    ...overrides,
  });
}

describe("WhatsNewDialog", () => {
  it("shows the trackarr section by version and the Plugins section by plugin and version", () => {
    renderDialog({ report: withUpdates() });

    const app = screen.getByTestId("whats-new-app-section");
    expect(within(app).getByRole("heading", { name: "trackarr" })).toBeInTheDocument();
    expect(within(screen.getByTestId("whats-new-app-0.4.0")).getByText(/Plugins moved/)).toBeInTheDocument();
    expect(within(screen.getByTestId("whats-new-app-0.5.0")).getByText("No release notes.")).toBeInTheDocument();

    const plugins = screen.getByTestId("whats-new-plugins-section");
    expect(within(plugins).getByRole("heading", { name: "Plugins" })).toBeInTheDocument();
    const seedpool = screen.getByTestId("whats-new-plugin-seedpool");
    expect(within(seedpool).getByText("Seedpool")).toBeInTheDocument();
    expect(within(seedpool).getByText("v1.0.0 → v1.1.0")).toBeInTheDocument();
    expect(within(seedpool).getByText("New buffer metric")).toBeInTheDocument();
    const asc = screen.getByTestId("whats-new-plugin-asc");
    expect(within(asc).getByText("asc")).toBeInTheDocument();
    expect(within(asc).getByText("installed v1.0.0")).toBeInTheDocument();
    expect(within(asc).getByText("No changelog for this version.")).toBeInTheDocument();
  });

  it("says when nothing is new in either section", () => {
    vi.mocked(usePluginCatalog).mockReturnValue({ data: undefined } as never);
    renderDialog({ report: whatsNewReport({ lastReadAt: "2026-11-01T08:00:00Z" }) });

    expect(screen.getByText(/Changes since you last looked on/)).toBeInTheDocument();
    expect(screen.getByText("No new trackarr release.")).toBeInTheDocument();
    expect(screen.getByText("No new plugin updates.")).toBeInTheDocument();
  });

  it("shows the release notes error and still renders the Plugins section when the app section is unavailable", () => {
    renderDialog({
      report: withUpdates({ app: appReport({ status: "unavailable", error: "The GitHub Releases API rate limit was reached (HTTP 403)." }) }),
    });

    const unavailable = screen.getByTestId("whats-new-app-unavailable");
    expect(within(unavailable).getByText("Could not load trackarr release notes.")).toBeInTheDocument();
    expect(within(unavailable).getByText(/rate limit/)).toBeInTheDocument();
    expect(screen.getByTestId("whats-new-plugin-seedpool")).toBeInTheDocument();
  });

  it("shows the unavailable message without a detailed error", () => {
    renderDialog({ report: whatsNewReport({ app: appReport({ status: "unavailable", error: null }) }) });

    expect(screen.getByText("Could not load trackarr release notes.")).toBeInTheDocument();
  });

  it("shows the update notice linking to the newer release", () => {
    renderDialog({ report: whatsNewReport({ app: appReport({ updateAvailable: true, latestRelease: release050 }) }) });

    expect(screen.getByRole("link", { name: "trackarr v0.5.0 available" })).toHaveAttribute("href", "https://example.test/v0.5.0");
  });

  it("shows loading and error states", () => {
    const { unmount } = render(<WhatsNewDialog open onOpenChange={vi.fn()} report={undefined} isLoading error={null} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    unmount();

    const { unmount: unmountError } = render(<WhatsNewDialog open onOpenChange={vi.fn()} report={undefined} isLoading={false} error={new Error("boom")} />);
    expect(screen.getByText("Could not load What's New: boom")).toBeInTheDocument();
    unmountError();

    render(<WhatsNewDialog open onOpenChange={vi.fn()} report={undefined} isLoading={false} error={null} />);
    expect(screen.getByText("Could not load What's New.")).toBeInTheDocument();
  });

  it("closes from the footer button", () => {
    const { onOpenChange } = renderDialog();

    const footerClose = screen.getAllByRole("button", { name: "Close" }).find((button) => !button.querySelector(".sr-only"));
    fireEvent.click(footerClose!);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders nothing when closed", () => {
    renderDialog({ open: false });

    expect(screen.queryByTestId("whats-new-dialog")).not.toBeInTheDocument();
  });
});
