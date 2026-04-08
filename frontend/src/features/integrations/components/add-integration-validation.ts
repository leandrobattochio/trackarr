import type { ApiPlugin, ApiPluginField } from "@/features/integrations/types";

export type AddIntegrationErrors = Record<string, string>;
export const BASE_URL_FIELD_NAME = "baseUrl";

const DECIMAL_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const CRON_PART_PATTERN = /^[\d/*,-]+$/;

export function getAllFields(plugin: ApiPlugin) {
  return [...plugin.fields, ...plugin.customFields];
}

export function getInitialFieldValues(
  plugin: ApiPlugin,
  existingValues: Record<string, string> = {},
): Record<string, string> {
  return {
    [BASE_URL_FIELD_NAME]: existingValues[BASE_URL_FIELD_NAME] ?? plugin.baseUrls[0] ?? "",
    ...Object.fromEntries(getAllFields(plugin).map((field) => [field.name, existingValues[field.name] ?? ""])),
  };
}

export function validateBaseUrlValue(plugin: ApiPlugin, value: string): string | null {
  if (value.trim().length === 0)
    return "Base URL is required.";

  if (!plugin.baseUrls.includes(value))
    return "Base URL must match one of the plugin's configured URLs.";

  return null;
}

export function validateFieldValue(field: ApiPluginField, value: string): string | null {
  const trimmedValue = value.trim();

  if (field.required && trimmedValue.length === 0)
    return `${field.label} is required.`;

  if (trimmedValue.length === 0)
    return null;

  if (stringEquals(field.type, "number") && !DECIMAL_PATTERN.test(trimmedValue))
    return `${field.label} must be a valid number.`;

  if (stringEquals(field.type, "cron") && !isValidCronExpression(trimmedValue))
    return `${field.label} must be a valid 5-part UTC cron expression.`;

  return null;
}

export function validateIntegrationFields(
  plugin: ApiPlugin,
  fieldValues: Record<string, string>,
): AddIntegrationErrors {
  const errors: AddIntegrationErrors = {};
  const baseUrlError = validateBaseUrlValue(plugin, fieldValues[BASE_URL_FIELD_NAME] ?? "");
  if (baseUrlError)
    errors[BASE_URL_FIELD_NAME] = baseUrlError;

  return getAllFields(plugin).reduce<AddIntegrationErrors>((result, field) => {
    const value = fieldValues[field.name] ?? "";
    const error = validateFieldValue(field, value);

    if (error)
      result[field.name] = error;

    return result;
  }, errors);
}

export function normalizeFieldValue(field: ApiPluginField, value: string): string {
  if (stringEquals(field.type, "number") || stringEquals(field.type, "cron"))
    return value.trim();

  return value;
}

export function normalizeIntegrationFieldValues(
  plugin: ApiPlugin,
  fieldValues: Record<string, string>,
): Record<string, string> {
  return getAllFields(plugin).reduce<Record<string, string>>((values, field) => {
    values[BASE_URL_FIELD_NAME] = (fieldValues[BASE_URL_FIELD_NAME] ?? "").trim();
    values[field.name] = normalizeFieldValue(field, fieldValues[field.name] ?? "");
    return values;
  }, {});
}

function isValidCronExpression(value: string): boolean {
  const parts = value.split(/\s+/);

  return parts.length === 5 && parts.every((part) => CRON_PART_PATTERN.test(part));
}

function stringEquals(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
