import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ApiPluginDownloadReport, ApiPluginDownloadStatus } from "@/features/settings/types";

vi.mock("lucide-react", () => ({
  Loader2: () => <svg data-testid="icon-loader" />,
}));

import { PluginDownloadStatus } from "@/features/settings/components/PluginDownloadStatus";
import { formatDateTime } from "@/shared/lib/formatters";

const SHA = "0f".repeat(32);

const successReport: ApiPluginDownloadReport = {
  startedAt: "2026-11-07T12:00:00+00:00",
  completedAt: "2026-11-07T12:00:05+00:00",
  source: "https://raw.githubusercontent.com/example/trackarr-plugins/main/",
  indexSha256: SHA,
  succeeded: true,
  error: null,
  plugins: [
    { pluginId: "asc", version: "1.1.0", outcome: "updated", overridden: false, outdated: false, hiddenByCustom: false, message: null },
    { pluginId: "bj-share", version: "1.0.0", outcome: "unchanged", overridden: true, outdated: true, hiddenByCustom: false, message: null },
    { pluginId: "seedpool", version: "1.0.0", outcome: "failed", overridden: false, outdated: false, hiddenByCustom: true, message: "Rejected plugins/seedpool.yaml: bad hash" },
    { pluginId: "oldtracker", version: null, outcome: "removed", overridden: false, outdated: false, hiddenByCustom: false, message: "Removed from the plugin index." },
  ],
};

function renderStatus(status: ApiPluginDownloadStatus | null, props: { isLoading?: boolean; error?: Error | null } = {}) {
  return render(<PluginDownloadStatus isLoading={props.isLoading ?? false} error={props.error ?? null} status={status} />);
}

describe("PluginDownloadStatus", () => {
  it("renders loading, request error and never-run states", () => {
    const { rerender } = renderStatus(null, { isLoading: true });
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();

    rerender(<PluginDownloadStatus isLoading={false} error={new Error("boom")} status={null} />);
    expect(screen.getByText("Failed to load the plugin download status: boom")).toBeInTheDocument();

    rerender(<PluginDownloadStatus isLoading={false} error={null} status={{ lastDownload: null, lastSuccessfulIndex: null }} />);
    expect(screen.getByTestId("plugin-download-none")).toHaveTextContent("No plugin download has run yet.");
    expect(screen.queryByTestId("plugin-download-result")).not.toBeInTheDocument();
  });

  it("renders a successful download with time, source, index hash and per-plugin outcomes", () => {
    renderStatus({
      lastDownload: successReport,
      lastSuccessfulIndex: { source: successReport.source, sha256: SHA, fetchedAt: successReport.completedAt },
    });

    expect(screen.getByTestId("plugin-download-result")).toHaveTextContent("Succeeded");
    const time = screen.getByTestId("plugin-download-time");
    expect(time).toHaveAttribute("dateTime", successReport.completedAt);
    expect(time).toHaveTextContent(formatDateTime(successReport.completedAt));
    expect(screen.getByTestId("plugin-download-source")).toHaveTextContent(successReport.source);
    expect(screen.getByTestId("plugin-download-index")).toHaveTextContent(SHA);
    expect(screen.queryByTestId("plugin-download-error")).not.toBeInTheDocument();

    expect(screen.getByTestId("plugin-download-outcome-asc")).toHaveTextContent("Updated");
    expect(screen.getByTestId("plugin-download-outcome-bj-share")).toHaveTextContent("Unchanged");
    const bjShare = within(screen.getByTestId("plugin-download-row-bj-share"));
    expect(bjShare.getByText("You have an override of this plugin.")).toBeInTheDocument();
    expect(bjShare.getByText("Your override is based on an older version.")).toBeInTheDocument();

    const seedpool = within(screen.getByTestId("plugin-download-row-seedpool"));
    expect(seedpool.getByTestId("plugin-download-outcome-seedpool")).toHaveTextContent("Failed");
    expect(seedpool.getByText("Rejected plugins/seedpool.yaml: bad hash")).toBeInTheDocument();
    expect(seedpool.getByText("A custom plugin with the same id is used instead.")).toBeInTheDocument();

    const removed = within(screen.getByTestId("plugin-download-row-oldtracker"));
    expect(removed.getByText("-")).toBeInTheDocument();
    expect(removed.getByTestId("plugin-download-outcome-oldtracker")).toHaveTextContent("Removed");
  });

  it("renders a failed download with its error and the plugins still in use", () => {
    const failed: ApiPluginDownloadReport = {
      ...successReport,
      completedAt: "2026-11-08T09:30:00+00:00",
      indexSha256: null,
      succeeded: false,
      error: "Could not download https://plugins.example/index.json: connection refused",
      plugins: [],
    };
    const { rerender } = renderStatus({
      lastDownload: failed,
      lastSuccessfulIndex: { source: successReport.source, sha256: SHA, fetchedAt: successReport.completedAt },
    });

    expect(screen.getByTestId("plugin-download-result")).toHaveTextContent("Failed");
    expect(screen.getByTestId("plugin-download-index")).toHaveTextContent("Not available");
    expect(screen.getByTestId("plugin-download-error")).toHaveTextContent(
      "The download failed: Could not download https://plugins.example/index.json: connection refused",
    );
    expect(screen.getByTestId("plugin-download-fallback")).toHaveTextContent(
      `Plugins from the last successful download (${formatDateTime(successReport.completedAt)}) are still in use.`,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    rerender(<PluginDownloadStatus isLoading={false} error={null} status={{ lastDownload: failed, lastSuccessfulIndex: null }} />);
    expect(screen.getByTestId("plugin-download-fallback")).toHaveTextContent(
      "No download has succeeded yet; the plugins already installed are kept.",
    );
  });

  it("shows an unknown outcome as is", () => {
    renderStatus({
      lastDownload: {
        ...successReport,
        plugins: [{ ...successReport.plugins[0], outcome: "futureOutcome" as never }],
      },
      lastSuccessfulIndex: null,
    });
    expect(screen.getByTestId("plugin-download-outcome-asc")).toHaveTextContent("futureOutcome");
  });
});
