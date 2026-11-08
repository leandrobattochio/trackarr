import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppUpdateNotice } from "@/features/whats-new/components/AppUpdateNotice";
import { appReport } from "@/features/whats-new/test-data";

const release = { version: "0.5.0", tagName: "v0.5.0", name: "v0.5.0", url: "https://github.com/leandrobattochio/trackarr/releases/tag/v0.5.0", publishedAt: null, notes: "" };

describe("AppUpdateNotice", () => {
  it("links to the newer release when an update is available", () => {
    render(<AppUpdateNotice app={appReport({ updateAvailable: true, latestRelease: release })} />);

    const link = screen.getByRole("link", { name: "trackarr v0.5.0 available" });
    expect(link).toHaveAttribute("href", release.url);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows plain text when the release has no URL", () => {
    render(<AppUpdateNotice app={appReport({ updateAvailable: true, latestRelease: { ...release, url: null } })} />);

    expect(screen.getByText("trackarr v0.5.0 available")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders nothing without an update", () => {
    const { container, rerender } = render(<AppUpdateNotice app={undefined} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<AppUpdateNotice app={appReport({ updateAvailable: false, latestRelease: release })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
