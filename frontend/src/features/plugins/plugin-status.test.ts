import { describe, expect, it } from "vitest";
import {
  getOutdatedMessage,
  getOutdatedOverrides,
  getOutdatedReviewPath,
  getOutdatedToneClass,
  getPluginBadges,
  getPluginEditorPath,
  getPluginNotices,
  getSaveHint,
  isNotInstalled,
  isOutdatedOverride,
} from "@/features/plugins/plugin-status";

const base = {
  pluginId: "seedpool",
  origin: "official" as const,
  version: "1.2.0",
  baseVersion: null,
  latestOfficialVersion: "1.2.0",
  outdated: false,
  orphan: false,
  deprecated: false,
  incompatible: false,
  incompatibleVersion: null,
  requiredAppVersion: null,
  incompatibleMessage: null,
  hiddenOfficial: false,
};

const labels = (plugin: typeof base | Record<string, unknown>) =>
  getPluginBadges({ ...base, ...plugin }).map((badge) => badge.label);

describe("plugin status badges", () => {
  it("labels official, edited and custom plugins with their version", () => {
    expect(labels({})).toEqual(["Official v1.2.0"]);
    expect(labels({ origin: "override", version: "1.1.0-local", baseVersion: "1.1.0" })).toEqual(["Edited (base v1.1.0)"]);
    expect(labels({ origin: "custom", version: "0.1.0" })).toEqual(["Custom v0.1.0"]);
  });

  it("omits a missing version", () => {
    expect(labels({ version: null })).toEqual(["Official"]);
    expect(labels({ origin: "override", baseVersion: null })).toEqual(["Edited"]);
    expect(labels({ origin: "custom", version: null })).toEqual(["Custom"]);
  });

  it("adds Orphan, Deprecated and Incompatible next to the origin badge", () => {
    expect(labels({ origin: "override", baseVersion: "1.0.0", orphan: true })).toEqual(["Edited (base v1.0.0)", "Orphan"]);
    expect(labels({ deprecated: true })).toEqual(["Official v1.2.0", "Deprecated"]);
    expect(labels({ incompatible: true, incompatibleVersion: "2.0.0" })).toEqual(["Official v1.2.0", "Incompatible"]);
  });

  it("adds Outdated with the latest official version to an outdated override", () => {
    expect(labels({ origin: "override", baseVersion: "1.0.0", outdated: true })).toEqual([
      "Edited (base v1.0.0)",
      "Outdated (official v1.2.0)",
    ]);
    expect(labels({ origin: "override", baseVersion: "1.0.0", outdated: true, latestOfficialVersion: null })).toEqual([
      "Edited (base v1.0.0)",
      "Outdated",
    ]);
    expect(labels({ outdated: true })).toEqual(["Official v1.2.0"]);
  });

  it("shows only Incompatible for an official plugin that could not be installed", () => {
    const notInstalled = { ...base, version: null, incompatible: true, incompatibleVersion: "1.0.0" };
    expect(isNotInstalled(notInstalled)).toBe(true);
    expect(labels(notInstalled)).toEqual(["Incompatible"]);
    expect(isNotInstalled({ ...notInstalled, origin: "custom" })).toBe(false);
  });
});

describe("plugin status notices", () => {
  const notices = (plugin: Record<string, unknown>) => getPluginNotices({ ...base, ...plugin });

  it("explains nothing for a plain plugin", () => {
    expect(notices({})).toEqual([]);
  });

  it("explains Orphan and Deprecated", () => {
    expect(notices({ origin: "override", orphan: true })).toEqual([
      { kind: "orphan", message: expect.stringContaining("Your edited copy keeps working") },
    ]);
    expect(notices({ deprecated: true })).toEqual([
      { kind: "deprecated", message: expect.stringContaining("cached copy keeps working") },
    ]);
  });

  it("names the required trackarr version when the index publishes it", () => {
    expect(notices({ incompatible: true, incompatibleVersion: "2.0.0", requiredAppVersion: "0.5.0", incompatibleMessage: "ignored" })).toEqual([
      { kind: "incompatible", message: "Requires trackarr 0.5.0 or later: update trackarr to receive seedpool v2.0.0." },
    ]);
    expect(notices({ incompatible: true, requiredAppVersion: "0.5.0" })[0].message).toBe(
      "Requires trackarr 0.5.0 or later: update trackarr to receive seedpool.",
    );
  });

  it("falls back to the server message, then to a generic one", () => {
    expect(notices({ incompatible: true, incompatibleMessage: "Update trackarr to receive seedpool 2.0.0." })[0].message).toBe(
      "Update trackarr to receive seedpool 2.0.0.",
    );
    expect(notices({ incompatible: true })[0].message).toContain("Requires a newer trackarr");
  });

  it("explains a custom plugin hiding an official one, only for customs", () => {
    expect(notices({ origin: "custom", hiddenOfficial: true })).toEqual([
      { kind: "hiddenOfficial", message: expect.stringContaining("An official plugin also uses the id seedpool") },
    ]);
    expect(notices({ hiddenOfficial: true })).toEqual([]);
  });
});

describe("outdated overrides", () => {
  const items = [
    { pluginId: "a", origin: "override" as const, outdated: true },
    { pluginId: "b", origin: "override" as const, outdated: false },
    { pluginId: "c", origin: "official" as const, outdated: true },
  ];

  it("selects only overrides marked outdated", () => {
    expect(getOutdatedOverrides(items).map((item) => item.pluginId)).toEqual(["a"]);
    expect(isOutdatedOverride(items[2])).toBe(false);
  });

  it("names the new official version and the base", () => {
    expect(getOutdatedMessage({ baseVersion: "1.0.0", latestOfficialVersion: "1.1.0" })).toBe(
      "A newer official version v1.1.0 is available. Your edited copy is based on v1.0.0.",
    );
    expect(getOutdatedMessage({ baseVersion: null, latestOfficialVersion: null })).toBe(
      "A newer official version is available.",
    );
  });

  it("highlights the warning when the last sync failed", () => {
    expect(getOutdatedToneClass(true)).toContain("text-destructive");
    expect(getOutdatedToneClass(false)).toContain("text-warning");
  });

  it("builds the review and editor paths", () => {
    expect(getOutdatedReviewPath("bj-share")).toBe("/plugins/bj-share/update");
    expect(getPluginEditorPath("bj-share")).toBe("/plugins?plugin=bj-share");
  });
});

describe("getSaveHint", () => {
  it("explains what Save writes for each origin", () => {
    expect(getSaveHint("official")).toBe("Save keeps your changes as an override; the official plugin file is never changed.");
    expect(getSaveHint(undefined)).toBe(getSaveHint("official"));
    expect(getSaveHint("override")).toBe(
      "Save updates your override. A copy that matches the official version again is discarded.",
    );
    expect(getSaveHint("custom")).toBe("Save writes your custom plugin.");
  });
});
