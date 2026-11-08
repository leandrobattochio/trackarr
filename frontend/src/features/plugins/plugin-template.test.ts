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
    expect(NEW_PLUGIN_TEMPLATE).toContain("customFields:");
    expect(NEW_PLUGIN_TEMPLATE).toContain("authFailure:");
    expect(NEW_PLUGIN_TEMPLATE).toContain("steps:");
    expect(NEW_PLUGIN_TEMPLATE).toContain("mapping:");
    expect(NEW_PLUGIN_TEMPLATE).toContain("dashboard:");
  });

  it("documents both JSON and HTML extraction examples", () => {
    expect(NEW_PLUGIN_TEMPLATE).toContain('responseType: json');
    expect(NEW_PLUGIN_TEMPLATE).toContain('path: data.ratio');
    expect(NEW_PLUGIN_TEMPLATE).toContain('responseType: html');
    expect(NEW_PLUGIN_TEMPLATE).toContain('countMatches: true');
    expect(NEW_PLUGIN_TEMPLATE).toContain('requiredRatio: "fields.required_ratio"');
  });
});
