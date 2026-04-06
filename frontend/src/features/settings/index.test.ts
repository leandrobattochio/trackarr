import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/settings/SettingsPage", () => ({
  default: "SettingsPageMock",
}));

describe("settings index exports", () => {
  it("re-exports SettingsPage", async () => {
    const module = await import("@/features/settings");
    expect(module.SettingsPage).toBe("SettingsPageMock");
  });
});
