import { describe, expect, it } from "vitest";
import {
  getAllFields,
  normalizeFieldValue,
  normalizeIntegrationFieldValues,
  validateFieldValue,
  validateIntegrationFields,
} from "@/features/integrations/components/add-integration-validation";

const plugin = {
  pluginId: "seedpool",
  displayName: "Seedpool",
  definitionValid: true,
  definitionError: null,
  dashboard: { metrics: [] },
  fields: [
    { name: "baseUrl", label: "Base URL", type: "text", required: true, sensitive: false },
    { name: "required_ratio", label: "Required Ratio", type: "number", required: true, sensitive: false },
    { name: "cron", label: "Cron", type: "cron", required: true, sensitive: false },
    { name: "username", label: "Username", type: "text", required: true, sensitive: false },
  ],
  customFields: [
    { name: "passkey", label: "Passkey", type: "text", required: false, sensitive: true },
  ],
};

describe("add integration validation", () => {
  it("returns every plugin field including custom fields", () => {
    expect(getAllFields(plugin).map((field) => field.name)).toEqual([
      "baseUrl",
      "required_ratio",
      "cron",
      "username",
      "passkey",
    ]);
  });

  it("validates required, url, number, and cron field rules", () => {
    expect(validateFieldValue(plugin.fields[0], "")).toBe("Base URL is required.");
    expect(validateFieldValue(plugin.fields[0], "ftp://tracker.test")).toBe("Base URL must be a valid http:// or https:// URL.");
    expect(validateFieldValue(plugin.fields[0], " http://my.local/url")).toBe("Base URL must be a valid http:// or https:// URL.");
    expect(validateFieldValue(plugin.fields[0], "http://my.local/url ")).toBe("Base URL must be a valid http:// or https:// URL.");
    expect(validateFieldValue(plugin.fields[0], "http://my.local/url")).toBeNull();
    expect(validateFieldValue(plugin.fields[1], "abc")).toBe("Required Ratio must be a valid number.");
    expect(validateFieldValue(plugin.fields[2], "* * *")).toBe("Cron must be a valid 5-part UTC cron expression.");
    expect(validateFieldValue(plugin.fields[3], "  alice  ")).toBeNull();
    expect(validateFieldValue(plugin.customFields[0], "")).toBeNull();
  });

  it("collects validation errors for the current field map", () => {
    expect(validateIntegrationFields(plugin, {
      baseUrl: "tracker.test",
      required_ratio: "1.25",
      cron: "0 * * * *",
      username: "",
    })).toEqual({
      baseUrl: "Base URL must be a valid http:// or https:// URL.",
      username: "Username is required.",
    });
  });

  it("normalizes only the typed fields that should be trimmed", () => {
    expect(normalizeFieldValue(plugin.fields[0], " https://tracker.test ")).toBe("https://tracker.test");
    expect(normalizeFieldValue(plugin.fields[1], " 1.25 ")).toBe("1.25");
    expect(normalizeFieldValue(plugin.fields[2], " 0 * * * * ")).toBe("0 * * * *");
    expect(normalizeFieldValue(plugin.fields[3], " alice ")).toBe(" alice ");
  });

  it("normalizes a full payload using plugin field metadata", () => {
    expect(normalizeIntegrationFieldValues(plugin, {
      baseUrl: " https://tracker.test ",
      required_ratio: " 1.25 ",
      cron: " 0 * * * * ",
      username: " alice ",
    })).toEqual({
      baseUrl: "https://tracker.test",
      required_ratio: "1.25",
      cron: "0 * * * *",
      username: " alice ",
      passkey: "",
    });
  });
});
