import { proxiesApi } from "@/features/proxies/api";
import type { ProxyDto } from "@/features/proxies/types";

const dto: ProxyDto = { name: "vpn", type: "socks5", host: "10.0.0.2", port: 1080, username: "alice", password: null };

describe("proxiesApi", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists proxies", async () => {
    await proxiesApi.list();

    expect(fetch).toHaveBeenCalledWith("/api/proxies", { headers: { "Content-Type": "application/json" } });
  });

  it("creates, updates and deletes a proxy", async () => {
    await proxiesApi.create(dto);
    await proxiesApi.update("proxy-1", dto);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await proxiesApi.delete("proxy-1");

    expect(fetch).toHaveBeenNthCalledWith(1, "/api/proxies", expect.objectContaining({ method: "POST", body: JSON.stringify(dto) }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/proxies/proxy-1", expect.objectContaining({ method: "PUT", body: JSON.stringify(dto) }));
    expect(fetch).toHaveBeenNthCalledWith(3, "/api/proxies/proxy-1", expect.objectContaining({ method: "DELETE" }));
  });

  it("tests a proxy, with the saved one's id when there is one", async () => {
    await proxiesApi.test("proxy-1", dto);
    await proxiesApi.test(null, dto);

    expect(fetch).toHaveBeenNthCalledWith(1, "/api/proxies/test", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ id: "proxy-1", proxy: dto }),
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/proxies/test", expect.objectContaining({
      body: JSON.stringify({ id: null, proxy: dto }),
    }));
  });
});
