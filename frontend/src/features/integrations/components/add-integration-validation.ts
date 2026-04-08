import type { ApiPlugin, ApiPluginField } from "@/features/integrations/types";

export type AddIntegrationErrors = Record<string, string>;

const DECIMAL_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const CRON_PART_PATTERN = /^[\d/*,\-]+$/;
const IPV4_HOST_PATTERN = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const DNS_HOST_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function getAllFields(plugin: ApiPlugin) {
  return [...plugin.fields, ...plugin.customFields];
}

export function validateFieldValue(field: ApiPluginField, value: string): string | null {
  const trimmedValue = value.trim();

  if (field.required && trimmedValue.length === 0)
    return `${field.label} is required.`;

  if (trimmedValue.length === 0)
    return null;

  if (stringEquals(field.name, "baseUrl") && !isValidHttpUrl(trimmedValue))
    return `${field.label} must be a valid http:// or https:// URL.`;

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
  return getAllFields(plugin).reduce<AddIntegrationErrors>((errors, field) => {
    const value = fieldValues[field.name] ?? "";
    const error = validateFieldValue(field, value);

    if (error)
      errors[field.name] = error;

    return errors;
  }, {});
}

export function normalizeFieldValue(field: ApiPluginField, value: string): string {
  if (stringEquals(field.name, "baseUrl") || stringEquals(field.type, "number") || stringEquals(field.type, "cron"))
    return value.trim();

  return value;
}

export function normalizeIntegrationFieldValues(
  plugin: ApiPlugin,
  fieldValues: Record<string, string>,
): Record<string, string> {
  return getAllFields(plugin).reduce<Record<string, string>>((values, field) => {
    values[field.name] = normalizeFieldValue(field, fieldValues[field.name] ?? "");
    return values;
  }, {});
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      return false;

    return isValidHost(url.hostname) && !url.hostname.endsWith(".");
  } catch {
    return false;
  }
}

function isValidCronExpression(value: string): boolean {
  const parts = value.split(/\s+/);

  return parts.length === 5 && parts.every((part) => CRON_PART_PATTERN.test(part));
}

function stringEquals(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function isValidHost(hostname: string): boolean {
  if (hostname === "localhost")
    return true;

  if (hostname.startsWith("[") && hostname.endsWith("]"))
    return true;

  return IPV4_HOST_PATTERN.test(hostname) || DNS_HOST_PATTERN.test(hostname);
}
