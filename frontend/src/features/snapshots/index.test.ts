import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/snapshots/SnapshotsPage", () => ({
  default: "SnapshotsPageMock",
}));

describe("snapshots index exports", () => {
  it("re-exports SnapshotsPage", async () => {
    const module = await import("@/features/snapshots");
    expect(module.SnapshotsPage).toBe("SnapshotsPageMock");
  });
});
