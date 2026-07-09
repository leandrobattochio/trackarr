export interface ApiSettings {
  userAgent: string;
  checkForUpdates: boolean;
  checkForUpdatesOverridden: boolean;
}

export interface ApiAboutInfo {
  version: string;
  dotNetVersion: string;
  runningInDocker: boolean;
  databaseEngine: string;
  appliedMigrations: number;
  appDataDirectory: string;
  startupDirectory: string;
  environmentName: string;
  uptime: string;
}

export interface ApiUpdateCheck {
  enabled: boolean;
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  checkedAt: string | null;
  error: string | null;
}
