import type { TrackerIntegration } from "@/features/integrations/types";

export function buildTracker(overrides: Partial<TrackerIntegration> = {}): TrackerIntegration {
  return {
    id: "tracker-1",
    pluginId: "seedpool",
    dashboard: { metrics: [] },
    byteUnitSystem: "binary",
    name: "Seedpool",
    payload: {},
    url: "https://seedpool.org/",
    proxyId: null,
    ratio: 1.5,
    uploaded: 2048,
    downloaded: 1024,
    seedBonus: null,
    buffer: null,
    hitAndRuns: null,
    requiredRatio: 1,
    seedingTorrents: 3,
    leechingTorrents: 0,
    activeTorrents: 3,
    lastSync: "5 min ago",
    lastSyncExact: "2026-11-08 10:00:00 GMT-3",
    nextAutomaticSync: "in 55 min",
    nextAutomaticSyncExact: "2026-11-08 11:00:00 GMT-3",
    status: "success",
    statusLabel: "success",
    configurationValid: true,
    configurationError: null,
    ...overrides,
  };
}
