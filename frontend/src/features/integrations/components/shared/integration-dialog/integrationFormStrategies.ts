import type { Dispatch, SetStateAction } from "react";
import { BASE_URL_FIELD_NAME } from "@/features/integrations/components/add-integration-validation";
import type { ApiPlugin, ApiPluginField } from "@/features/integrations/types";

export interface IntegrationFormStrategy {
  getBaseUrlProps(): {
    id: string;
    value: string;
    error?: string;
    onChange: (value: string) => void;
  };
  getFieldProps(field: ApiPluginField): {
    id: string;
    value: string;
    error?: string;
    placeholder?: string;
    required?: boolean;
    onChange: (value: string) => void;
  };
}

interface AddIntegrationStrategyArgs {
  plugin: ApiPlugin;
  fieldValues: Record<string, string>;
  fieldErrors: Record<string, string>;
  clearSubmitError: () => void;
  setFieldValues: Dispatch<SetStateAction<Record<string, string>>>;
  setFieldErrors: Dispatch<SetStateAction<Record<string, string>>>;
  validateBaseUrlValue: (plugin: ApiPlugin, value: string) => string | null;
  validateFieldValue: (field: ApiPluginField, value: string) => string | null;
  normalizeFieldValue: (field: ApiPluginField, value: string) => string;
}

export function createAddIntegrationFormStrategy({
  plugin,
  fieldValues,
  fieldErrors,
  clearSubmitError,
  setFieldValues,
  setFieldErrors,
  validateBaseUrlValue,
  validateFieldValue,
  normalizeFieldValue,
}: AddIntegrationStrategyArgs): IntegrationFormStrategy {
  return {
    getBaseUrlProps: () => ({
      id: BASE_URL_FIELD_NAME,
      value: fieldValues[BASE_URL_FIELD_NAME] ?? "",
      error: fieldErrors[BASE_URL_FIELD_NAME],
      onChange: (value) => {
        clearSubmitError();
        setFieldValues((prev) => ({ ...prev, [BASE_URL_FIELD_NAME]: value }));
        setFieldErrors((prev) => {
          const nextError = validateBaseUrlValue(plugin, value);
          if (!nextError) {
            const { [BASE_URL_FIELD_NAME]: _removed, ...rest } = prev;
            return rest;
          }

          return { ...prev, [BASE_URL_FIELD_NAME]: nextError };
        });
      },
    }),
    getFieldProps: (field) => ({
      id: field.name,
      value: fieldValues[field.name] ?? "",
      error: fieldErrors[field.name],
      placeholder: getFieldPlaceholder(field.type),
      onChange: (value) => {
        clearSubmitError();
        setFieldValues((prev) => ({ ...prev, [field.name]: value }));
        setFieldErrors((prev) => {
          const nextError = validateFieldValue(field, normalizeFieldValue(field, value));
          if (!nextError) {
            const { [field.name]: _removed, ...rest } = prev;
            return rest;
          }

          return { ...prev, [field.name]: nextError };
        });
      },
    }),
  };
}

const SENSITIVE_MASK = "*****";

interface EditIntegrationStrategyArgs {
  trackerId: string;
  fieldValues: Record<string, string>;
  setFieldValues: Dispatch<SetStateAction<Record<string, string>>>;
}

export function createEditIntegrationFormStrategy({
  trackerId,
  fieldValues,
  setFieldValues,
}: EditIntegrationStrategyArgs): IntegrationFormStrategy {
  return {
    getBaseUrlProps: () => ({
      id: `${trackerId}-${BASE_URL_FIELD_NAME}`,
      value: fieldValues[BASE_URL_FIELD_NAME] ?? "",
      onChange: (value) => {
        setFieldValues((prev) => ({ ...prev, [BASE_URL_FIELD_NAME]: value }));
      },
    }),
    getFieldProps: (field) => ({
      id: `${trackerId}-${field.name}`,
      value: fieldValues[field.name] ?? "",
      placeholder: field.sensitive ? SENSITIVE_MASK : getFieldPlaceholder(field.type),
      required: field.required,
      onChange: (value) => {
        setFieldValues((prev) => ({ ...prev, [field.name]: value }));
      },
    }),
  };
}

function getFieldPlaceholder(type: string): string | undefined {
  if (type === "cron") return "0 * * * *";
  if (type === "number") return "1.00";
  return undefined;
}
