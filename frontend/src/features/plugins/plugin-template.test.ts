import { describe, expect, it } from "vitest";
import { NEW_PLUGIN_TEMPLATE } from "@/features/plugins/plugin-template";

describe("NEW_PLUGIN_TEMPLATE", () => {
  it("includes the required sections for a starter plugin definition", () => {
    expect(NEW_PLUGIN_TEMPLATE).toContain("pluginId: <your-plugin-id>");
    expect(NEW_PLUGIN_TEMPLATE).toContain("displayName: My Tracker");
    expect(NEW_PLUGIN_TEMPLATE).toContain("version: 1.0.0");
    expect(NEW_PLUGIN_TEMPLATE).toContain("schemaVersion: 1");
    expect(NEW_PLUGIN_TEMPLATE).toContain("baseUrls:");
    expect(NEW_PLUGIN_TEMPLATE).toContain("fields:");
    expect(NEW_PLUGIN_TEMPLATE).toContain("steps:");
    expect(NEW_PLUGIN_TEMPLATE).toContain('requiredRatio: "fields.required_ratio"');
    expect(NEW_PLUGIN_TEMPLATE).toContain("dashboard:");
  });

  it("points to the wiki instead of explaining the format in comments", () => {
    expect(NEW_PLUGIN_TEMPLATE.split("\n")[0]).toBe(
      "# How to write a plugin: https://github.com/leandrobattochio/trackarr/wiki/Writing-a-Plugin",
    );
    expect(NEW_PLUGIN_TEMPLATE.match(/^\s*#/gm)).toHaveLength(1);
  });
});
