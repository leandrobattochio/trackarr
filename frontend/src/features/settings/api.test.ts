import { settingsApi } from "@/features/settings/api";

describe("settingsApi", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads settings", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      userAgent: "agent-1",
      checkForUpdates: true,
      checkForUpdatesOverridden: false,
    }), { status: 200 }));

    await settingsApi.get();

    expect(fetch).toHaveBeenCalledWith("/api/settings", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("loads about information", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      version: "1.0.0",
      dotNetVersion: "10.0.0",
      runningInDocker: true,
      databaseEngine: "PostgreSQL",
      appliedMigrations: 3,
      appDataDirectory: "/data",
      startupDirectory: "/app",
      environmentName: "Production",
      uptime: "01:23:45",
    }), { status: 200 }));

    await settingsApi.getAbout();

    expect(fetch).toHaveBeenCalledWith("/api/about", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("loads update check information", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      enabled: true,
      currentVersion: "1.0.0",
      latestVersion: "1.0.1",
      updateAvailable: true,
      releaseUrl: "https://github.test/release",
      checkedAt: "2026-04-09T21:00:00Z",
      error: null,
    }), { status: 200 }));

    await settingsApi.getUpdateCheck();

    expect(fetch).toHaveBeenCalledWith("/api/update-check", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("updates settings", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      userAgent: "agent-2",
      checkForUpdates: false,
      checkForUpdatesOverridden: true,
    }), { status: 200 }));

    await settingsApi.update({ userAgent: "agent-2", checkForUpdates: false });

    expect(fetch).toHaveBeenCalledWith("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ userAgent: "agent-2", checkForUpdates: false }),
      headers: { "Content-Type": "application/json" },
    });
  });
});
