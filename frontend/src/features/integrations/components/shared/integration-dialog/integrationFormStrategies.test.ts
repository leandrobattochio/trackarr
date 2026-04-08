import { describe, expect, it, vi } from "vitest";
import { createAddIntegrationFormStrategy, createEditIntegrationFormStrategy } from "@/features/integrations/components/shared/integration-dialog/integrationFormStrategies";

const plugin = {
  pluginId: "seedpool",
  displayName: "Seedpool",
  baseUrls: ["https://seedpool.org/"],
  fields: [
    { name: "cron", label: "Cron", type: "cron", required: true, sensitive: false },
    { name: "ratio", label: "Ratio", type: "number", required: false, sensitive: false },
    { name: "username", label: "Username", type: "text", required: false, sensitive: false },
  ],
  customFields: [
    { name: "passkey", label: "Passkey", type: "text", required: false, sensitive: true },
  ],
};

describe("integrationFormStrategies", () => {
  it("adds errors for invalid add-dialog changes and falls back to empty values", () => {
    const clearSubmitError = vi.fn();
    const setFieldValues = vi.fn();
    const setFieldErrors = vi.fn();
    const validateBaseUrlValue = vi.fn(() => "Base URL is invalid.");
    const validateFieldValue = vi.fn(() => "Cron is invalid.");
    const normalizeFieldValue = vi.fn((_field, value: string) => value.trim());

    const strategy = createAddIntegrationFormStrategy({
      plugin,
      fieldValues: {},
      fieldErrors: {},
      clearSubmitError,
      setFieldValues,
      setFieldErrors,
      validateBaseUrlValue,
      validateFieldValue,
      normalizeFieldValue,
    });

    const baseUrlProps = strategy.getBaseUrlProps();
    expect(baseUrlProps.value).toBe("");

    baseUrlProps.onChange("https://invalid.example/");

    expect(clearSubmitError).toHaveBeenCalledTimes(1);
    expect(setFieldValues.mock.calls[0][0]({})).toEqual({ baseUrl: "https://invalid.example/" });
    expect(setFieldErrors.mock.calls[0][0]({})).toEqual({ baseUrl: "Base URL is invalid." });
    expect(validateBaseUrlValue).toHaveBeenCalledWith(plugin, "https://invalid.example/");

    const cronProps = strategy.getFieldProps(plugin.fields[0]);
    expect(cronProps.value).toBe("");
    expect(cronProps.placeholder).toBe("0 * * * *");

    cronProps.onChange("  * * *  ");

    expect(setFieldValues.mock.calls[1][0]({})).toEqual({ cron: "  * * *  " });
    expect(setFieldErrors.mock.calls[1][0]({})).toEqual({ cron: "Cron is invalid." });
    expect(normalizeFieldValue).toHaveBeenCalledWith(plugin.fields[0], "  * * *  ");
    expect(validateFieldValue).toHaveBeenCalledWith(plugin.fields[0], "* * *");
  });

  it("removes add-dialog errors when validation succeeds", () => {
    const setFieldValues = vi.fn();
    const setFieldErrors = vi.fn();
    const strategy = createAddIntegrationFormStrategy({
      plugin,
      fieldValues: { baseUrl: "https://seedpool.org/", ratio: "1.5" },
      fieldErrors: { baseUrl: "old", ratio: "old" },
      clearSubmitError: vi.fn(),
      setFieldValues,
      setFieldErrors,
      validateBaseUrlValue: vi.fn(() => null),
      validateFieldValue: vi.fn(() => null),
      normalizeFieldValue: vi.fn((_field, value: string) => value.trim()),
    });

    strategy.getBaseUrlProps().onChange("https://seedpool.org/");
    expect(setFieldValues.mock.calls[0][0]({})).toEqual({ baseUrl: "https://seedpool.org/" });
    expect(setFieldErrors.mock.calls[0][0]({ baseUrl: "old", ratio: "old" })).toEqual({ ratio: "old" });

    const ratioProps = strategy.getFieldProps(plugin.fields[1]);
    expect(ratioProps.value).toBe("1.5");
    expect(ratioProps.placeholder).toBe("1.00");
    ratioProps.onChange("2.0");
    expect(setFieldValues.mock.calls[1][0]({})).toEqual({ ratio: "2.0" });
    expect(setFieldErrors.mock.calls[1][0]({ baseUrl: "old", ratio: "old" })).toEqual({ baseUrl: "old" });

    const usernameProps = strategy.getFieldProps(plugin.fields[2]);
    expect(usernameProps.placeholder).toBeUndefined();
  });

  it("builds edit-dialog ids, placeholders, required flags, and default values", () => {
    const setFieldValues = vi.fn();
    const strategy = createEditIntegrationFormStrategy({
      trackerId: "tracker-1",
      fieldValues: {},
      setFieldValues,
    });

    const baseUrlProps = strategy.getBaseUrlProps();
    expect(baseUrlProps.id).toBe("tracker-1-baseUrl");
    expect(baseUrlProps.value).toBe("");

    baseUrlProps.onChange("https://seedpool.org/");
    expect(setFieldValues.mock.calls[0][0]({})).toEqual({ baseUrl: "https://seedpool.org/" });

    const cronProps = strategy.getFieldProps(plugin.fields[0]);
    expect(cronProps.id).toBe("tracker-1-cron");
    expect(cronProps.placeholder).toBe("0 * * * *");
    expect(cronProps.required).toBe(true);
    expect(cronProps.value).toBe("");

    const usernameProps = strategy.getFieldProps(plugin.fields[2]);
    expect(usernameProps.placeholder).toBeUndefined();

    const passkeyProps = strategy.getFieldProps(plugin.customFields[0]);
    expect(passkeyProps.placeholder).toBe("*****");

    passkeyProps.onChange("pk");
    expect(setFieldValues.mock.calls[1][0]({})).toEqual({ passkey: "pk" });
  });
});
