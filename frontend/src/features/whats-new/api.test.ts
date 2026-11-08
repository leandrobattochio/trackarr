import { whatsNewApi } from "@/features/whats-new/api";

describe("whatsNewApi", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the What's New report", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ shouldAutoOpen: true }), { status: 200 }));

    await expect(whatsNewApi.get()).resolves.toEqual({ shouldAutoOpen: true });

    expect(fetch).toHaveBeenCalledWith("/api/whats-new", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("marks the plugin updates and the app version shown as read", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await whatsNewApi.markRead({ pluginChangeId: 7, appVersion: "0.5.2" });

    expect(fetch).toHaveBeenCalledWith("/api/whats-new/read", {
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({ pluginChangeId: 7, appVersion: "0.5.2" }),
    });
  });

  it("marks everything as read", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await expect(whatsNewApi.markRead()).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith("/api/whats-new/read", {
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  });
});
