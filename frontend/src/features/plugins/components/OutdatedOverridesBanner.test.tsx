import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OutdatedOverridesBanner } from "@/features/plugins/components/OutdatedOverridesBanner";
import { usePluginCatalog } from "@/features/plugins/hooks";
import type { ApiPluginListItem } from "@/features/plugins/types";

vi.mock("@/features/plugins/hooks", () => ({
  usePluginCatalog: vi.fn(),
}));

function plugin(overrides: Partial<ApiPluginListItem>): ApiPluginListItem {
  return {
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
    ...overrides,
  };
}

function renderBanner(data: ApiPluginListItem[] | undefined) {
  vi.mocked(usePluginCatalog).mockReturnValue({ data } as never);
  return render(
    <MemoryRouter>
      <OutdatedOverridesBanner />
    </MemoryRouter>,
  );
}

describe("OutdatedOverridesBanner", () => {
  beforeEach(() => {
    vi.mocked(usePluginCatalog).mockReset();
  });

  it("renders nothing while the catalog is loading or nothing is outdated", () => {
    const { container, unmount } = renderBanner(undefined);
    expect(container).toBeEmptyDOMElement();
    unmount();

    const second = renderBanner([plugin({ outdated: false }), plugin({ pluginId: "asc", origin: "official" })]);
    expect(second.container).toBeEmptyDOMElement();
  });

  it("names each outdated override with a link to its review page and no close button", () => {
    renderBanner([
      plugin({}),
      plugin({ pluginId: "asc", displayName: "Amigos Share", baseVersion: "2.0.0", latestOfficialVersion: "2.1.0" }),
      plugin({ pluginId: "bj-share", displayName: "BJ-Share", outdated: false }),
    ]);

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Seedpool uses an outdated override. A newer official version v1.1.0 is available. Your edited copy is based on v1.0.0.");
    expect(banner).toHaveTextContent("Amigos Share uses an outdated override.");
    expect(banner).not.toHaveTextContent("BJ-Share");
    expect(screen.getByRole("link", { name: "Review Seedpool update" })).toHaveAttribute("href", "/plugins/seedpool/update");
    expect(screen.getByRole("link", { name: "Review Amigos Share update" })).toHaveAttribute("href", "/plugins/asc/update");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByTestId("outdated-override-seedpool")).toHaveAttribute("data-highlighted", "false");
  });

  it("highlights an override whose last sync failed", () => {
    renderBanner([plugin({ lastSyncFailed: true })]);

    const item = screen.getByTestId("outdated-override-seedpool");
    expect(item).toHaveAttribute("data-highlighted", "true");
    expect(item).toHaveClass("text-destructive");
    expect(item).toHaveTextContent("Its last sync failed.");
  });
});
