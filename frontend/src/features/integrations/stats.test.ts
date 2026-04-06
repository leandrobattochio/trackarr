import { describe, expect, it } from "vitest";
import { INTEGRATION_STAT_DEFINITIONS, SNAPSHOT_CHART_STAT_KEYS } from "@/features/integrations/stats";

describe("integration stats", () => {
  it("defines unique stat keys with required dashboard metadata", () => {
    const keys = INTEGRATION_STAT_DEFINITIONS.map((stat) => stat.key);
    const uniqueKeys = new Set(keys);

    expect(uniqueKeys.size).toBe(keys.length);
    expect(INTEGRATION_STAT_DEFINITIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "ratio",
          label: "Ratio",
          dashboardMetric: true,
          snapshotStored: true,
        }),
        expect.objectContaining({
          key: "activeTorrents",
          category: "activity",
          format: "count",
          snapshotCharted: true,
        }),
      ]),
    );
  });

  it("exports only charted snapshot stat keys in definition order", () => {
    const expectedKeys = INTEGRATION_STAT_DEFINITIONS.filter((stat) => stat.snapshotCharted).map((stat) => stat.key);

    expect(SNAPSHOT_CHART_STAT_KEYS).toEqual(expectedKeys);
    expect(SNAPSHOT_CHART_STAT_KEYS).toEqual([
      "uploadedBytes",
      "downloadedBytes",
      "seedingTorrents",
      "leechingTorrents",
      "activeTorrents",
    ]);
  });
});
