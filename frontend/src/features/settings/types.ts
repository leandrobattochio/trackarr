export interface ApiSettings {
  userAgent: string;
}

export interface ApiAboutInfo {
  version: string;
  dotNetVersion: string;
  runningInDocker: boolean;
  databaseEngine: string;
  databasePath: string | null;
  appliedMigrations: number;
  appDataDirectory: string;
  startupDirectory: string;
  environmentName: string;
  uptime: string;
}

export type ApiPluginDownloadOutcome =
  | "installed"
  | "updated"
  | "unchanged"
  | "failed"
  | "incompatible"
  | "locallyModified"
  | "orphan"
  | "deprecated"
  | "removed";

export interface ApiPluginDownloadPluginResult {
  pluginId: string;
  version: string | null;
  outcome: ApiPluginDownloadOutcome;
  overridden: boolean;
  outdated: boolean;
  hiddenByCustom: boolean;
  message: string | null;
}

export interface ApiPluginDownloadReport {
  startedAt: string;
  completedAt: string;
  source: string;
  indexSha256: string | null;
  succeeded: boolean;
  error: string | null;
  plugins: ApiPluginDownloadPluginResult[];
}

export interface ApiPluginDownloadStatus {
  lastDownload: ApiPluginDownloadReport | null;
  lastSuccessfulIndex: { source: string; sha256: string; fetchedAt: string } | null;
}
