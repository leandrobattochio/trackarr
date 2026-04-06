import { describe, expect, it } from "vitest";
import { defaultSnapshotRange, formatSnapshotRangeLabel, isSnapshotRangeKey } from "@/features/snapshots/range";

describe("snapshot range helpers", () => {
  it("recognizes supported snapshot ranges", () => {
    expect(isSnapshotRangeKey("15m")).toBe(true);
    expect(isSnapshotRangeKey("custom")).toBe(true);
    expect(isSnapshotRangeKey("2d")).toBe(false);
    expect(defaultSnapshotRange).toBe("1h");
  });

  it("formats preset and custom labels", () => {
    expect(formatSnapshotRangeLabel("15m")).toBe("15 min");
    expect(formatSnapshotRangeLabel("custom", "2026-04-05T10:00", "2026-04-05T11:00"))
      .toBe("2026-04-05T10:00 to 2026-04-05T11:00");
  });
});
