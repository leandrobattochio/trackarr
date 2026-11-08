import { afterEach, describe, expect, it, vi } from "vitest";
import { getBlockingIntegrations, pluginApi } from "@/features/plugins/api";
import { ApiError } from "@/shared/api/http";

describe("pluginApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists plugins", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    }));

    await pluginApi.list();

    expect(fetch).toHaveBeenCalledWith("/api/plugins", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("loads a plugin definition as text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue("pluginId: seedpool"),
    }));

    await pluginApi.getDefinition("seedpool");

    expect(fetch).toHaveBeenCalledWith("/api/plugins/seedpool", undefined);
  });

  it("loads a plugin diff", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ pluginId: "seedpool" }),
    }));

    await pluginApi.getDiff("seedpool");

    expect(fetch).toHaveBeenCalledWith("/api/plugins/seedpool/diff", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("creates a plugin definition using yaml content type", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ pluginId: "custom-plugin" }),
    }));

    await pluginApi.createDefinition("pluginId: custom-plugin");

    expect(fetch).toHaveBeenCalledWith("/api/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/yaml" },
      body: "pluginId: custom-plugin",
    });
  });

  it("updates a plugin definition using yaml content type", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ pluginId: "seedpool" }),
    }));

    await pluginApi.updateDefinition("seedpool", "pluginId: seedpool");

    expect(fetch).toHaveBeenCalledWith("/api/plugins/seedpool", {
      method: "PUT",
      headers: { "Content-Type": "application/yaml" },
      body: "pluginId: seedpool",
    });
  });

  it("deletes a plugin override", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));

    await pluginApi.deleteOverride("seedpool");

    expect(fetch).toHaveBeenCalledWith("/api/plugins/seedpool/override", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("deletes a custom plugin", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));

    await pluginApi.deleteCustom("my-tracker");

    expect(fetch).toHaveBeenCalledWith("/api/plugins/my-tracker", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("reads the blocking integrations only from a 409 that lists them", () => {
    const integrations = [{ id: "1", url: "https://tracker.example/" }];

    expect(getBlockingIntegrations(new ApiError("In use", 409, { error: "In use", integrations }))).toEqual(integrations);
    expect(getBlockingIntegrations(new ApiError("In use", 409, { error: "In use" }))).toBeNull();
    expect(getBlockingIntegrations(new ApiError("In use", 409, null))).toBeNull();
    expect(getBlockingIntegrations(new ApiError("Not found", 404, { integrations }))).toBeNull();
    expect(getBlockingIntegrations(new Error("network"))).toBeNull();
  });

  it("posts a dry run with the editor YAML or the official version", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ outcome: "success" }),
    }));

    await pluginApi.test({ integrationId: "integration-1", yaml: "pluginId: seedpool" });
    await pluginApi.test({ integrationId: "integration-1", useOfficial: true });

    expect(fetch).toHaveBeenNthCalledWith(1, "/api/plugins/test", {
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({ integrationId: "integration-1", yaml: "pluginId: seedpool" }),
    });
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/plugins/test", {
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({ integrationId: "integration-1", useOfficial: true }),
    });
  });
});
