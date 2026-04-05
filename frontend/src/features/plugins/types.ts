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
  pluginGroup: string;
  displayName: string;
  source: PluginSource;
  fields: ApiPluginFieldDefinition[];
}

export interface SavePluginResponse {
  pluginId: string;
  source: PluginSource;
}
