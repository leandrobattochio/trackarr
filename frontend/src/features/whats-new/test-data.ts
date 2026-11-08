import type { ApiAppReleaseReport, ApiWhatsNew } from "@/features/whats-new/types";

export function appReport(overrides: Partial<ApiAppReleaseReport> = {}): ApiAppReleaseReport {
  return {
    status: "available",
    installedVersion: "0.4.0",
    latestRelease: null,
    updateAvailable: false,
    releases: [],
    checkedAt: "2026-11-07T10:00:00Z",
    error: null,
    ...overrides,
  };
}

export function whatsNewReport(overrides: Partial<ApiWhatsNew> = {}): ApiWhatsNew {
  return {
    shouldAutoOpen: false,
    lastReadAppVersion: null,
    lastReadPluginChangeId: null,
    lastReadAt: null,
    app: appReport(),
    pluginUpdates: [],
    ...overrides,
  };
}
