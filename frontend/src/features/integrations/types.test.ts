import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mapIntegration, type ApiIntegration, type ApiPlugin } from "@/features/integrations/types";

describe("mapIntegration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("maps stats and plugin metadata into the tracker card model", () => {
    const integration: ApiIntegration = {
      id: "integration-1",
      pluginId: "seedpool",
      dashboard: null,
      payload: { baseUrl: "https://seedpool.org", username: null },
      url: "https://seedpool.org",
      requiredRatio: 1.5,
      lastSyncAt: "2026-04-05T23:30:00.000Z",
      nextAutomaticSyncAt: "2026-04-06T01:00:00.000Z",
      lastSyncResult: "success",
      configurationValid: true,
      configurationError: null,
      stats: {
        ratio: 2.5,
        uploadedBytes: 2048,
        downloadedBytes: 1024,
        seedBonus: "50",
        buffer: "5 GiB",
        hitAndRuns: 0,
        requiredRatio: 1.25,
        seedingTorrents: 5,
        leechingTorrents: 1,
        activeTorrents: 6,
      },
    };

    const plugins: ApiPlugin[] = [{
      pluginId: "seedpool",
      displayName: "Seedpool",
      definitionValid: true,
      definitionError: null,
      dashboard: {
        byteUnitSystem: "decimal",
        metrics: [],
      },
      fields: [],
      customFields: [],
    }];

    const result = mapIntegration(integration, plugins);

    expect(result.name).toBe("Seedpool");
    expect(result.byteUnitSystem).toBe("decimal");
    expect(result.payload).toEqual({ baseUrl: "https://seedpool.org", username: "" });
    expect(result.status).toBe("success");
    expect(result.statusLabel).toBe("success");
    expect(result.requiredRatio).toBe(1.5);
    expect(result.uploaded).toBe(2048);
    expect(result.lastSync).toBe("30 min ago");
    expect(result.nextAutomaticSync).toBe("in 1h");
    expect(result.lastSyncExact).toBeTruthy();
    expect(result.nextAutomaticSyncExact).toBeTruthy();
  });

  it("falls back to pending when an integration has never synced", () => {
    const integration: ApiIntegration = {
      id: "integration-2",
      pluginId: "unknown-plugin",
      dashboard: null,
      payload: {},
      url: null,
      requiredRatio: null,
      lastSyncAt: null,
      nextAutomaticSyncAt: null,
      lastSyncResult: null,
      configurationValid: false,
      configurationError: "Broken config",
      stats: null,
    };

    const result = mapIntegration(integration, []);

    expect(result.name).toBe("unknown-plugin");
    expect(result.byteUnitSystem).toBe("binary");
    expect(result.status).toBe("pending");
    expect(result.statusLabel).toBe("never synced");
    expect(result.configurationError).toBe("Broken config");
  });

  it("derives unknown error when last sync exists without stats or explicit result", () => {
    const integration: ApiIntegration = {
      id: "integration-3",
      pluginId: "seedpool",
      dashboard: {
        metrics: [],
      },
      payload: {},
      url: null,
      requiredRatio: null,
      lastSyncAt: "2026-04-05T23:59:30.000Z",
      nextAutomaticSyncAt: null,
      lastSyncResult: null,
      configurationValid: true,
      configurationError: null,
      stats: null,
    };

    const result = mapIntegration(integration, []);

    expect(result.status).toBe("unknownError");
    expect(result.statusLabel).toBe("unknown error");
    expect(result.lastSync).toBe("Just now");
  });
});
