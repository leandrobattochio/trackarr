import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/settings/components/AboutTab", () => ({
  AboutTab: "AboutTabMock",
}));

vi.mock("@/features/settings/components/HttpSettingsTab", () => ({
  HttpSettingsTab: "HttpSettingsTabMock",
}));

describe("settings components index exports", () => {
  it("re-exports AboutTab and HttpSettingsTab", async () => {
    const module = await import("@/features/settings/components");
    expect(module.AboutTab).toBe("AboutTabMock");
    expect(module.HttpSettingsTab).toBe("HttpSettingsTabMock");
  });
});
