/* c8 ignore start */
import type { ApiDashboardConfig, ApiIntegrationStats, ApiSyncResult } from "@/features/integrations/types";

export interface ApiPluginFieldDefinition {
  name: string;
  label: string;
  description?: string | null;
  type: string;
  required: boolean;
  sensitive: boolean;
}

export type PluginOrigin = "official" | "override" | "custom";

export interface ApiPluginStatus {
  origin: PluginOrigin;
  version: string | null;
  baseVersion: string | null;
  /** The installed official version: the newest one this trackarr can use. */
  latestOfficialVersion: string | null;
  outdated: boolean;
  orphan: boolean;
  deprecated: boolean;
  incompatible: boolean;
  incompatibleVersion: string | null;
  requiredSchemaVersion: number | null;
  /** Null when the plugin index does not publish it. */
  requiredAppVersion: string | null;
  incompatibleMessage: string | null;
  hiddenOfficial: boolean;
  lastSyncFailed: boolean;
}

export interface ApiPluginListItem extends ApiPluginStatus {
  pluginId: string;
  displayName: string;
  definitionValid: boolean;
  definitionError: string | null;
  dashboard: ApiDashboardConfig | null;
  baseUrls: string[];
  fields: ApiPluginFieldDefinition[];
  customFields: ApiPluginFieldDefinition[];
}

export interface ApiPluginChangelogEntry {
  version: string;
  date: string;
  notes: string;
}

export interface ApiPluginDiff {
  pluginId: string;
  origin: PluginOrigin;
  baseVersion: string | null;
  latestOfficialVersion: string | null;
  base: string | null;
  yours: string | null;
  latestOfficial: string | null;
  changelog: ApiPluginChangelogEntry[];
}

export type PluginTestRequest = { integrationId: string } & ({ yaml: string } | { useOfficial: true });

export interface ApiPluginTestStep {
  name: string;
  method: string;
  path: string;
  statusCode: number;
}

export interface ApiPluginTestFailedField {
  /** Null for a mapping field. */
  step: string | null;
  field: string;
  error: string;
}

export interface ApiPluginTestResult {
  outcome: ApiSyncResult;
  steps: ApiPluginTestStep[];
  stats: ApiIntegrationStats | null;
  failedField: ApiPluginTestFailedField | null;
  error: string | null;
}

export interface ApiPluginBlockingIntegration {
  id: string;
  url: string | null;
}

export interface SavePluginResponse {
  pluginId: string;
}
/* c8 ignore stop */
