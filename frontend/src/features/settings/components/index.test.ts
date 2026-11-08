import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/settings/components/AboutTab", () => ({
  AboutTab: "AboutTabMock",
}));

vi.mock("@/features/settings/components/HttpSettingsTab", () => ({
  HttpSettingsTab: "HttpSettingsTabMock",
}));

vi.mock("@/features/settings/components/PluginDownloadStatus", () => ({
  PluginDownloadStatus: "PluginDownloadStatusMock",
}));

describe("settings components index exports", () => {
  it("re-exports AboutTab and HttpSettingsTab", async () => {
    const module = await import("@/features/settings/components");
    expect(module.AboutTab).toBe("AboutTabMock");
    expect(module.HttpSettingsTab).toBe("HttpSettingsTabMock");
    expect(module.PluginDownloadStatus).toBe("PluginDownloadStatusMock");
  });
});
