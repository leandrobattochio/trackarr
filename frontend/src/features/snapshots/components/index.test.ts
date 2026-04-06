import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/snapshots/components/SnapshotFiltersCard", () => ({
  SnapshotFiltersCard: "SnapshotFiltersCardMock",
}));

vi.mock("@/features/snapshots/components/SnapshotLineChartCard", () => ({
  SnapshotLineChartCard: "SnapshotLineChartCardMock",
}));

vi.mock("@/features/snapshots/components/SnapshotSummaryCards", () => ({
  SnapshotSummaryCards: "SnapshotSummaryCardsMock",
}));

describe("snapshots components index exports", () => {
  it("re-exports all snapshot components", async () => {
    const module = await import("@/features/snapshots/components");

    expect(module.SnapshotFiltersCard).toBe("SnapshotFiltersCardMock");
    expect(module.SnapshotLineChartCard).toBe("SnapshotLineChartCardMock");
    expect(module.SnapshotSummaryCards).toBe("SnapshotSummaryCardsMock");
  });
});
