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
  dashboard: ApiDashboardConfig;
  fields: ApiPluginFieldDefinition[];
}

export interface SavePluginResponse {
  pluginId: string;
  source: PluginSource;
}
