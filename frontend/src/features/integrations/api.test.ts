import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/features/integrations/api";

describe("integrations api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists integrations", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    }));

    await api.integrations.list();

    expect(fetch).toHaveBeenCalledWith("/api/integrations", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("creates an integration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    }));

    await api.integrations.create({
      pluginId: "seedpool",
      payload: "{\"apiKey\":\"x\"}",
    });

    expect(fetch).toHaveBeenCalledWith("/api/integrations", {
      method: "POST",
      body: "{\"pluginId\":\"seedpool\",\"payload\":\"{\\\"apiKey\\\":\\\"x\\\"}\"}",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("updates an integration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    }));

    await api.integrations.update("integration-1", {
      pluginId: "seedpool",
      payload: "{\"apiKey\":\"y\"}",
    });

    expect(fetch).toHaveBeenCalledWith("/api/integrations/integration-1", {
      method: "PUT",
      body: "{\"pluginId\":\"seedpool\",\"payload\":\"{\\\"apiKey\\\":\\\"y\\\"}\"}",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("syncs an integration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    }));

    await api.integrations.sync("integration-1");

    expect(fetch).toHaveBeenCalledWith("/api/integrations/integration-1/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("deletes an integration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: vi.fn(),
    }));

    await api.integrations.delete("integration-1");

    expect(fetch).toHaveBeenCalledWith("/api/integrations/integration-1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("lists plugins for the dashboard", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    }));

    await api.plugins.list();

    expect(fetch).toHaveBeenCalledWith("/api/plugins", {
      headers: { "Content-Type": "application/json" },
    });
  });
});
