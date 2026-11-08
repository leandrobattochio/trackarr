import { describe, expect, it } from "vitest";
import type { ApiPluginUpdate } from "@/features/whats-new/types";
import { compareVersions, formatDate, groupPluginUpdates } from "@/features/whats-new/whats-new";

function update(overrides: Partial<ApiPluginUpdate>): ApiPluginUpdate {
  return { id: 1, pluginId: "asc", fromVersion: "1.0.0", toVersion: "1.1.0", appliedAt: "2026-11-07T10:00:00Z", changelog: [], ...overrides };
}

describe("compareVersions", () => {
  it.each([
    ["1.2.0", "1.10.0", -1],
    ["2.0.0", "1.9.9", 1],
    ["1.0.0", "1.0.0", 0],
    ["1.0.0-beta", "1.0.0", -1],
    ["1.0.0", "1.0.0-beta", 1],
    ["1.0.0-alpha", "1.0.0-beta", -1],
    ["1.0.0-beta", "1.0.0-alpha", 1],
    ["1.0.0-rc.2", "1.0.0-rc.10", -1],
    ["1.0.0-rc.10", "1.0.0-rc.2", 1],
    ["1.0.0-1", "1.0.0-alpha", -1],
    ["1.0.0-alpha", "1.0.0-alpha.1", -1],
    ["1.0.0+build", "1.0.0", 0],
    ["1.0", "1.0.0", 0],
    ["1.0.0", "1.0", 0],
  ])("compares %s with %s", (left, right, sign) => {
    expect(Math.sign(compareVersions(left, right))).toBe(sign);
  });
});

describe("groupPluginUpdates", () => {
  it("returns no group without updates", () => {
    expect(groupPluginUpdates([])).toEqual([]);
  });

  it("merges updates of one plugin, keeping the newest first and the oldest starting version", () => {
    const groups = groupPluginUpdates([
      update({ id: 3, pluginId: "asc", fromVersion: "1.1.0", toVersion: "1.2.0", changelog: [{ version: "1.2.0", date: "2026-11-07", notes: "Second" }] }),
      update({ id: 2, pluginId: "seedpool", fromVersion: null, toVersion: "1.0.0" }),
      update({
        id: 1,
        pluginId: "asc",
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        changelog: [
          { version: "1.1.0", date: "2026-11-01", notes: "First" },
          { version: "1.2.0", date: "2026-11-07", notes: "Duplicate" },
        ],
      }),
    ]);

    expect(groups).toEqual([
      {
        pluginId: "asc",
        fromVersion: "1.0.0",
        toVersion: "1.2.0",
        changelog: [
          { version: "1.2.0", date: "2026-11-07", notes: "Second" },
          { version: "1.1.0", date: "2026-11-01", notes: "First" },
        ],
      },
      { pluginId: "seedpool", fromVersion: null, toVersion: "1.0.0", changelog: [] },
    ]);
  });

  it("sorts one update's changelog newest first", () => {
    const [group] = groupPluginUpdates([
      update({
        changelog: [
          { version: "1.0.1", date: "2026-10-01", notes: "a" },
          { version: "1.1.0", date: "2026-11-01", notes: "b" },
        ],
      }),
    ]);

    expect(group.changelog.map((entry) => entry.version)).toEqual(["1.1.0", "1.0.1"]);
  });
});

describe("formatDate", () => {
  it("formats ISO dates in UTC and keeps unknown text", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate("2026-11-07")).toContain("2026");
    expect(formatDate("2026-11-07")).toContain("7");
    expect(formatDate("soon")).toBe("soon");
  });
});
