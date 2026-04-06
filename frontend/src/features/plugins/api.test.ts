import { afterEach, describe, expect, it, vi } from "vitest";
import { pluginApi } from "@/features/plugins/api";

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
});
