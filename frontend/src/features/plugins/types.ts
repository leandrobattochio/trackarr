import type { ApiDashboardConfig } from "@/features/integrations/types";

export type PluginSource = "disk" | "database";

export interface ApiPluginFieldDefinition {
  name: string;
  label: string;
  type: string;
  required: boolean;
  sensitive: boolean;
}

export interface ApiPluginListItem {
  pluginId: string;
  displayName: string;
  source: PluginSource;
  definitionValid: boolean;
  definitionError: string | null;
  dashboard: ApiDashboardConfig | null;
  fields: ApiPluginFieldDefinition[];
  customFields: ApiPluginFieldDefinition[];
}

export interface SavePluginResponse {
  pluginId: string;
  source: PluginSource;
}
