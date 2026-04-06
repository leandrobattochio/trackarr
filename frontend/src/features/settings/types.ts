export interface ApiSettings {
  userAgent: string;
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
