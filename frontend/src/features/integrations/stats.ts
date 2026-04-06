import type { ApiDashboardMetric } from "@/features/integrations/types";

export type IntegrationStatKey = ApiDashboardMetric["stat"];

interface IntegrationStatDefinition {
  key: IntegrationStatKey;
  label: string;
  format: ApiDashboardMetric["format"];
  category: "health" | "transfer" | "tracker" | "activity";
  description: string;
  dashboardMetric: boolean;
  snapshotStored: boolean;
  snapshotCharted: boolean;
}

export const INTEGRATION_STAT_DEFINITIONS: readonly IntegrationStatDefinition[] = [
  {
    key: "ratio",
    label: "Ratio",
    format: "text",
    category: "health",
    description: "Upload-to-download ratio for the integration.",
    dashboardMetric: true,
    snapshotStored: true,
    snapshotCharted: false,
  },
  {
    key: "requiredRatio",
    label: "Required Ratio",
    format: "text",
    category: "health",
    description: "Configured minimum ratio used for warning and threshold checks.",
    dashboardMetric: true,
    snapshotStored: true,
    snapshotCharted: false,
  },
  {
    key: "uploadedBytes",
    label: "Uploaded",
    format: "bytes",
    category: "transfer",
    description: "Total uploaded data reported by the tracker.",
    dashboardMetric: true,
    snapshotStored: true,
    snapshotCharted: true,
  },
  {
    key: "downloadedBytes",
    label: "Downloaded",
    format: "bytes",
    category: "transfer",
    description: "Total downloaded data reported by the tracker.",
    dashboardMetric: true,
    snapshotStored: true,
    snapshotCharted: true,
  },
  {
    key: "seedBonus",
    label: "Seed Bonus",
    format: "text",
    category: "tracker",
    description: "Bonus or reward balance earned from tracker-specific seeding rules.",
    dashboardMetric: true,
    snapshotStored: true,
    snapshotCharted: false,
  },
  {
    key: "buffer",
    label: "Buffer",
    format: "text",
    category: "tracker",
    description: "Tracker-defined download headroom before ratio pressure builds.",
    dashboardMetric: true,
    snapshotStored: true,
    snapshotCharted: false,
  },
  {
    key: "hitAndRuns",
    label: "Hit & Runs",
    format: "count",
    category: "tracker",
    description: "Tracker compliance count for torrents that still need seeding time.",
    dashboardMetric: true,
    snapshotStored: true,
    snapshotCharted: false,
  },
  {
    key: "seedingTorrents",
    label: "Seeding Torrents",
    format: "count",
    category: "activity",
    description: "Torrents currently uploading to peers.",
    dashboardMetric: true,
    snapshotStored: true,
    snapshotCharted: true,
  },
  {
    key: "leechingTorrents",
    label: "Leeching Torrents",
    format: "count",
    category: "activity",
    description: "Torrents still downloading data.",
    dashboardMetric: true,
    snapshotStored: true,
    snapshotCharted: true,
  },
  {
    key: "activeTorrents",
    label: "Active Torrents",
    format: "count",
    category: "activity",
    description: "Combined active torrent workload for the integration.",
    dashboardMetric: true,
    snapshotStored: true,
    snapshotCharted: true,
  },
] as const;

export const SNAPSHOT_CHART_STAT_KEYS = INTEGRATION_STAT_DEFINITIONS
  .filter((stat) => stat.snapshotCharted)
  .map((stat) => stat.key);
