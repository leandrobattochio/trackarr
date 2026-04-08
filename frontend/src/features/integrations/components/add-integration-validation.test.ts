import { describe, expect, it } from "vitest";
import {
  getInitialFieldValues,
  getAllFields,
  normalizeFieldValue,
  normalizeIntegrationFieldValues,
  validateBaseUrlValue,
  validateFieldValue,
  validateIntegrationFields,
} from "@/features/integrations/components/add-integration-validation";

const plugin = {
  pluginId: "seedpool",
  displayName: "Seedpool",
  definitionValid: true,
  definitionError: null,
  dashboard: { metrics: [] },
  baseUrls: ["https://seedpool.org/", "https://alt.seedpool.org/"],
  fields: [
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
      "required_ratio",
      "cron",
      "username",
      "passkey",
    ]);
  });

  it("builds initial values with the first configured base url", () => {
    expect(getInitialFieldValues(plugin)).toEqual({
      baseUrl: "https://seedpool.org/",
      required_ratio: "",
      cron: "",
      username: "",
      passkey: "",
    });
  });

  it("validates required base url, number, and cron rules", () => {
    expect(validateBaseUrlValue(plugin, "")).toBe("Base URL is required.");
    expect(validateBaseUrlValue(plugin, "https://unknown.example/")).toBe("Base URL must match one of the plugin's configured URLs.");
    expect(validateBaseUrlValue(plugin, "https://seedpool.org/")).toBeNull();
    expect(validateFieldValue(plugin.fields[0], "abc")).toBe("Required Ratio must be a valid number.");
    expect(validateFieldValue(plugin.fields[1], "* * *")).toBe("Cron must be a valid 5-part UTC cron expression.");
    expect(validateFieldValue(plugin.fields[2], "  alice  ")).toBeNull();
    expect(validateFieldValue(plugin.customFields[0], "")).toBeNull();
  });

  it("collects validation errors for the current field map", () => {
    expect(validateIntegrationFields(plugin, {
      baseUrl: "https://unknown.example/",
      required_ratio: "1.25",
      cron: "0 * * * *",
      username: "",
    })).toEqual({
      baseUrl: "Base URL must match one of the plugin's configured URLs.",
      username: "Username is required.",
    });
  });

  it("normalizes only the typed fields that should be trimmed", () => {
    expect(normalizeFieldValue(plugin.fields[0], " 1.25 ")).toBe("1.25");
    expect(normalizeFieldValue(plugin.fields[1], " 0 * * * * ")).toBe("0 * * * *");
    expect(normalizeFieldValue(plugin.fields[2], " alice ")).toBe(" alice ");
  });

  it("normalizes a full payload using plugin field metadata", () => {
    expect(normalizeIntegrationFieldValues(plugin, {
      baseUrl: " https://seedpool.org/ ",
      required_ratio: " 1.25 ",
      cron: " 0 * * * * ",
      username: " alice ",
    })).toEqual({
      baseUrl: "https://seedpool.org/",
      required_ratio: "1.25",
      cron: "0 * * * *",
      username: " alice ",
      passkey: "",
    });
  });
});
