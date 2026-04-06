import { afterEach, describe, expect, it, vi } from "vitest";
import { snapshotsApi } from "@/features/snapshots/api";

describe("snapshotsApi.list", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a snapshots query string and delegates to the shared request helper", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        integrationId: "integration-1",
        range: "custom",
        from: "2026-04-05T00:00:00.000Z",
        to: "2026-04-06T00:00:00.000Z",
        items: [],
      }),
    }));

    await snapshotsApi.list({
      integrationId: "integration-1",
      range: "custom",
      from: "2026-04-05T00:00:00.000Z",
      to: "2026-04-06T00:00:00.000Z",
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/snapshots?integrationId=integration-1&range=custom&from=2026-04-05T00%3A00%3A00.000Z&to=2026-04-06T00%3A00%3A00.000Z",
      { headers: { "Content-Type": "application/json" } },
    );
  });

  it("builds a preset snapshots query string without custom bounds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        integrationId: "integration-1",
        range: "15m",
        from: "2026-04-05T00:45:00.000Z",
        to: "2026-04-05T01:00:00.000Z",
        items: [],
      }),
    }));

    await snapshotsApi.list({
      integrationId: "integration-1",
      range: "15m",
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/snapshots?integrationId=integration-1&range=15m",
      { headers: { "Content-Type": "application/json" } },
    );
  });
});
