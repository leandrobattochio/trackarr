import { afterEach, describe, expect, it, vi } from "vitest";
import { request, requestText } from "@/shared/api/http";

describe("request", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed json for successful responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true }),
    }));

    const result = await request<{ ok: boolean }>("/integrations");

    expect(fetch).toHaveBeenCalledWith("/api/integrations", {
      headers: { "Content-Type": "application/json" },
    });
    expect(result).toEqual({ ok: true });
  });

  it("returns undefined for 204 responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: vi.fn(),
    }));

    const result = await request<void>("/integrations/1", { method: "DELETE" });

    expect(result).toBeUndefined();
  });

  it("throws backend error messages when present", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Bad Request",
      json: vi.fn().mockResolvedValue({ error: "Invalid payload" }),
    }));

    await expect(request("/integrations")).rejects.toThrow("Invalid payload");
  });

  it("falls back to status text when error json is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Unauthorized",
      json: vi.fn().mockRejectedValue(new Error("bad json")),
    }));

    await expect(request("/integrations")).rejects.toThrow("Unauthorized");
  });
});

describe("requestText", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns raw text for successful responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue("pluginId: seedpool"),
    }));

    const result = await requestText("/plugins/seedpool");

    expect(result).toBe("pluginId: seedpool");
  });

  it("throws backend text request errors using the response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Conflict",
      json: vi.fn().mockResolvedValue({ error: "Plugin already exists" }),
    }));

    await expect(requestText("/plugins")).rejects.toThrow("Plugin already exists");
  });

  it("falls back to status text for text requests when error body is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Gateway Timeout",
      json: vi.fn().mockRejectedValue(new Error("invalid json")),
    }));

    await expect(requestText("/plugins")).rejects.toThrow("Gateway Timeout");
  });
});
