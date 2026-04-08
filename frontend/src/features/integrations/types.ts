import type { ByteUnitSystem } from "@/shared/lib/formatters";

// ---------------------------------------------------------------------------
// Backend API response types (mirrors what IntegrationsController returns)
// ---------------------------------------------------------------------------

export interface ApiIntegrationStats {
  ratio: number | null;
  uploadedBytes: number | null;
  downloadedBytes: number | null;
  seedBonus: string | null;
  buffer: string | null;
  hitAndRuns: number | null;
  requiredRatio: number | null;
  seedingTorrents: number | null;
  leechingTorrents: number | null;
  activeTorrents: number | null;
}

export interface ApiDashboardMetric {
  stat: "ratio" | "uploadedBytes" | "downloadedBytes" | "seedBonus" | "buffer" | "hitAndRuns" | "requiredRatio" | "seedingTorrents" | "leechingTorrents" | "activeTorrents";
  label: string;
  format: "bytes" | "count" | "text";
  icon: string;
  tone: string;
}

export interface ApiDashboardConfig {
  byteUnitSystem?: ByteUnitSystem | null;
  metrics: ApiDashboardMetric[];
}

export interface ApiIntegration {
  id: string;
  pluginId: string;
  dashboard: ApiDashboardConfig | null;
  payload: Record<string, string | null>;
  url: string | null;
  requiredRatio: number | null;
  lastSyncAt: string | null;
  nextAutomaticSyncAt: string | null;
  lastSyncResult: ApiSyncResult | null;
  configurationValid: boolean;
  configurationError: string | null;
  stats: ApiIntegrationStats | null;
}

export type ApiSyncResult = "success" | "authFailed" | "unknownError";

export interface ApiPluginField {
  name: string;
  label: string;
  description?: string | null;
  type: string;
  required: boolean;
  sensitive: boolean;
}

export interface ApiPlugin {
  pluginId: string;
  displayName: string;
  definitionValid: boolean;
  definitionError: string | null;
  dashboard: ApiDashboardConfig | null;
  baseUrls: string[];
  fields: ApiPluginField[];
  customFields: ApiPluginField[];
}

export interface CreateIntegrationDto {
  pluginId: string;
  payload: string;
}

export interface UpdateIntegrationDto {
  pluginId: string;
  payload: string;
}

// ---------------------------------------------------------------------------
// Frontend view model
// ---------------------------------------------------------------------------

export type IntegrationStatus = "success" | "authFailed" | "unknownError" | "pending";

export interface TrackerIntegration {
  id: string;
  pluginId: string;
  dashboard: ApiDashboardConfig | null;
  byteUnitSystem: ByteUnitSystem;
  name: string;
  payload: Record<string, string>;
  url: string | null;
  ratio: number | null;
  uploaded: number | null;
  downloaded: number | null;
  seedBonus: string | null;
  buffer: string | null;
  hitAndRuns: number | null;
  requiredRatio: number | null;
  seedingTorrents: number | null;
  leechingTorrents: number | null;
  activeTorrents: number | null;
  lastSync: string | null;
  lastSyncExact: string | null;
  nextAutomaticSync: string | null;
  nextAutomaticSyncExact: string | null;
  status: IntegrationStatus;
  statusLabel: string;
  configurationValid: boolean;
  configurationError: string | null;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

const DISPLAY_TIMEZONE = import.meta.env.VITE_APP_TIMEZONE || "America/Sao_Paulo";

function formatRelativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const isFuture = diffMs > 0;
  const totalMinutes = Math.floor(Math.abs(diffMs) / 60_000);

  if (totalMinutes < 1) return isFuture ? "in under a minute" : "Just now";
  if (totalMinutes < 60) return isFuture ? `in ${totalMinutes} min` : `${totalMinutes} min ago`;

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) return isFuture ? `in ${totalHours}h` : `${totalHours}h ago`;

  const totalDays = Math.floor(totalHours / 24);
  return isFuture ? `in ${totalDays}d` : `${totalDays}d ago`;
}

function formatExactTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: DISPLAY_TIMEZONE,
    timeZoneName: "short",
  }).format(new Date(iso));
}

function deriveStatus(integration: ApiIntegration): IntegrationStatus {
  if (integration.lastSyncResult !== null) return integration.lastSyncResult;
  if (integration.stats !== null) return "success";
  if (integration.lastSyncAt !== null) return "unknownError";
  return "pending";
}

function getStatusLabel(status: IntegrationStatus): string {
  switch (status) {
    case "success":
      return "success";
    case "authFailed":
      return "auth failed";
    case "unknownError":
      return "unknown error";
    case "pending":
      return "never synced";
  }
}

export function mapIntegration(
  integration: ApiIntegration,
  plugins: ApiPlugin[],
): TrackerIntegration {
  const plugin = plugins.find((p) => p.pluginId === integration.pluginId);
  const status = deriveStatus(integration);

  return {
    id: integration.id,
    pluginId: integration.pluginId,
    dashboard: integration.dashboard ?? plugin?.dashboard ?? null,
    byteUnitSystem: integration.dashboard?.byteUnitSystem ?? plugin?.dashboard?.byteUnitSystem ?? "binary",
    name: plugin?.displayName ?? integration.pluginId,
    payload: Object.fromEntries(
      Object.entries(integration.payload).map(([key, value]) => [key, value ?? ""]),
    ),
    url: integration.url,
    ratio: integration.stats?.ratio ?? null,
    uploaded: integration.stats?.uploadedBytes ?? null,
    downloaded: integration.stats?.downloadedBytes ?? null,
    seedBonus: integration.stats?.seedBonus ?? null,
    buffer: integration.stats?.buffer ?? null,
    hitAndRuns: integration.stats?.hitAndRuns ?? null,
    requiredRatio: integration.requiredRatio ?? integration.stats?.requiredRatio ?? null,
    seedingTorrents: integration.stats?.seedingTorrents ?? null,
    leechingTorrents: integration.stats?.leechingTorrents ?? null,
    activeTorrents: integration.stats?.activeTorrents ?? null,
    lastSync: integration.lastSyncAt ? formatRelativeTime(integration.lastSyncAt) : null,
    lastSyncExact: integration.lastSyncAt ? formatExactTime(integration.lastSyncAt) : null,
    nextAutomaticSync: integration.nextAutomaticSyncAt ? formatRelativeTime(integration.nextAutomaticSyncAt) : null,
    nextAutomaticSyncExact: integration.nextAutomaticSyncAt ? formatExactTime(integration.nextAutomaticSyncAt) : null,
    status,
    statusLabel: getStatusLabel(status),
    configurationValid: integration.configurationValid,
    configurationError: integration.configurationError,
  };
}
