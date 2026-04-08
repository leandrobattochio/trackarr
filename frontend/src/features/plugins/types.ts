/* c8 ignore start */
import type { ApiDashboardConfig } from "@/features/integrations/types";

export interface ApiPluginFieldDefinition {
  name: string;
  label: string;
  description?: string | null;
  type: string;
  required: boolean;
  sensitive: boolean;
}

export interface ApiPluginListItem {
  pluginId: string;
  displayName: string;
  definitionValid: boolean;
  definitionError: string | null;
  dashboard: ApiDashboardConfig | null;
  baseUrls: string[];
  fields: ApiPluginFieldDefinition[];
  customFields: ApiPluginFieldDefinition[];
}

export interface SavePluginResponse {
  pluginId: string;
}
/* c8 ignore stop */
