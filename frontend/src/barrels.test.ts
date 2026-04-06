import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/help/HelpPage", () => ({ default: "HelpPageMock" }));
vi.mock("@/features/settings/components/AboutTab", () => ({ AboutTab: "AboutTabMock" }));
vi.mock("@/features/settings/components/HttpSettingsTab", () => ({ HttpSettingsTab: "HttpSettingsTabMock" }));
vi.mock("@/features/snapshots/components/SnapshotFiltersCard", () => ({ SnapshotFiltersCard: "SnapshotFiltersCardMock" }));
vi.mock("@/features/snapshots/components/SnapshotLineChartCard", () => ({ SnapshotLineChartCard: "SnapshotLineChartCardMock" }));
vi.mock("@/features/snapshots/components/SnapshotSummaryCards", () => ({ SnapshotSummaryCards: "SnapshotSummaryCardsMock" }));

describe("feature barrels", () => {
  it("re-exports help and feature component modules", async () => {
    const help = await import("@/features/help");
    const settingsComponents = await import("@/features/settings/components");
    const snapshotComponents = await import("@/features/snapshots/components");

    expect(help.HelpPage).toBe("HelpPageMock");
    expect(settingsComponents.AboutTab).toBe("AboutTabMock");
    expect(settingsComponents.HttpSettingsTab).toBe("HttpSettingsTabMock");
    expect(snapshotComponents.SnapshotFiltersCard).toBe("SnapshotFiltersCardMock");
    expect(snapshotComponents.SnapshotLineChartCard).toBe("SnapshotLineChartCardMock");
    expect(snapshotComponents.SnapshotSummaryCards).toBe("SnapshotSummaryCardsMock");
  });
});
