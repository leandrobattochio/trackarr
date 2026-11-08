import type { ApiPluginChangelogEntry } from "@/features/plugins/types";

export interface ApiAppRelease {
  version: string;
  tagName: string;
  name: string | null;
  url: string | null;
  publishedAt: string | null;
  notes: string;
}

export interface ApiAppReleaseReport {
  status: "available" | "unavailable";
  installedVersion: string;
  latestRelease: ApiAppRelease | null;
  updateAvailable: boolean;
  releases: ApiAppRelease[];
  checkedAt: string | null;
  error: string | null;
}

export interface ApiPluginUpdate {
  id: number;
  pluginId: string;
  fromVersion: string | null;
  toVersion: string;
  appliedAt: string;
  changelog: ApiPluginChangelogEntry[];
}

export interface ApiWhatsNew {
  shouldAutoOpen: boolean;
  lastReadAppVersion: string | null;
  lastReadPluginChangeId: number | null;
  lastReadAt: string | null;
  app: ApiAppReleaseReport;
  pluginUpdates: ApiPluginUpdate[];
}
