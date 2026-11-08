import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PluginStatusBadges, PluginStatusNotices } from "@/features/plugins/components/PluginStatusBadges";
import type { ApiPluginListItem } from "@/features/plugins/types";

function plugin(overrides: Partial<ApiPluginListItem> = {}): ApiPluginListItem {
  return {
    pluginId: "seedpool",
    displayName: "Seedpool",
    definitionValid: true,
    definitionError: null,
    dashboard: null,
    baseUrls: [],
    fields: [],
    customFields: [],
    origin: "official",
    version: "1.2.0",
    baseVersion: null,
    latestOfficialVersion: "1.2.0",
    outdated: false,
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

function renderStatus(item: ApiPluginListItem) {
  return render(
    <>
      <PluginStatusBadges plugin={item} />
      <PluginStatusNotices plugin={item} />
    </>,
  );
}

describe("PluginStatusBadges", () => {
  it.each([
    ["official", plugin(), "Official v1.2.0"],
    ["edited", plugin({ origin: "override", version: "1.1.0", baseVersion: "1.1.0" }), "Edited (base v1.1.0)"],
    ["custom", plugin({ origin: "custom", version: "0.1.0" }), "Custom v0.1.0"],
  ])("renders the %s badge without a notice", (kind, item, label) => {
    const { container } = renderStatus(item);

    expect(screen.getByTestId(`plugin-badge-${kind}`)).toHaveTextContent(label);
    expect(container.querySelector("[data-testid^='plugin-notice-']")).toBeNull();
  });

  it("renders the Outdated badge on an outdated override", () => {
    renderStatus(plugin({ origin: "override", baseVersion: "1.0.0", latestOfficialVersion: "1.2.0", outdated: true }));

    expect(screen.getByTestId("plugin-badge-outdated")).toHaveTextContent("Outdated (official v1.2.0)");
  });

  it("renders the Orphan badge with its explanation", () => {
    renderStatus(plugin({ origin: "override", baseVersion: "1.0.0", orphan: true }));

    expect(screen.getByTestId("plugin-badge-edited")).toHaveTextContent("Edited (base v1.0.0)");
    expect(screen.getByTestId("plugin-badge-orphan")).toHaveTextContent("Orphan");
    expect(screen.getByTestId("plugin-notice-orphan")).toHaveTextContent("Removed from the official repository");
  });

  it("renders the Deprecated badge with its explanation", () => {
    renderStatus(plugin({ deprecated: true }));

    expect(screen.getByTestId("plugin-badge-deprecated")).toHaveTextContent("Deprecated");
    expect(screen.getByTestId("plugin-notice-deprecated")).toHaveTextContent("cached copy keeps working");
  });

  it("renders the Incompatible badge naming the required trackarr version", () => {
    renderStatus(plugin({ incompatible: true, incompatibleVersion: "2.0.0", requiredSchemaVersion: 2, requiredAppVersion: "0.5.0" }));

    expect(screen.getByTestId("plugin-badge-official")).toHaveTextContent("Official v1.2.0");
    expect(screen.getByTestId("plugin-badge-incompatible")).toHaveTextContent("Incompatible");
    expect(screen.getByTestId("plugin-notice-incompatible")).toHaveTextContent(
      "Requires trackarr 0.5.0 or later: update trackarr to receive seedpool v2.0.0.",
    );
  });

  it("renders a hidden-official notice on a custom plugin without any action", () => {
    renderStatus(plugin({ origin: "custom", version: "1.0.0", hiddenOfficial: true }));

    expect(screen.getByTestId("plugin-badge-custom")).toHaveTextContent("Custom v1.0.0");
    expect(screen.getByTestId("plugin-notice-hiddenOfficial")).toHaveTextContent("An official plugin also uses the id seedpool");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
