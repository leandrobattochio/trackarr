import { settingsApi } from "@/features/settings/api";

describe("settingsApi", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads settings", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ userAgent: "agent-1" }), { status: 200 }));

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

  it("updates settings", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ userAgent: "agent-2" }), { status: 200 }));

    await settingsApi.update("agent-2");

    expect(fetch).toHaveBeenCalledWith("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ userAgent: "agent-2" }),
      headers: { "Content-Type": "application/json" },
    });
  });
});
