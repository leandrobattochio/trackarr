import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { proxiesApi } from "@/features/proxies/api";
import { PROXIES_KEY, useDeleteProxy, useProxies, useSaveProxy, useTestProxy } from "@/features/proxies/hooks";
import type { ApiProxy, ProxyDto } from "@/features/proxies/types";

vi.mock("@/features/proxies/api", () => ({
  proxiesApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), test: vi.fn() },
}));

const proxy: ApiProxy = { id: "proxy-1", name: "vpn", type: "http", host: "10.0.0.2", port: 3128, username: null, hasPassword: false };
const dto: ProxyDto = { name: "vpn", type: "http", host: "10.0.0.2", port: 3128, username: null, password: null };

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidate };
}

describe("proxy hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the proxies", async () => {
    vi.mocked(proxiesApi.list).mockResolvedValueOnce([proxy]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useProxies(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([proxy]));
  });

  it("creates a new proxy and updates a saved one, refreshing the list", async () => {
    vi.mocked(proxiesApi.create).mockResolvedValueOnce(proxy);
    vi.mocked(proxiesApi.update).mockResolvedValueOnce(proxy);
    const { wrapper, invalidate } = createWrapper();
    const { result } = renderHook(() => useSaveProxy(), { wrapper });

    await act(() => result.current.mutateAsync({ id: null, dto }));
    await act(() => result.current.mutateAsync({ id: "proxy-1", dto }));

    expect(proxiesApi.create).toHaveBeenCalledWith(dto);
    expect(proxiesApi.update).toHaveBeenCalledWith("proxy-1", dto);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: PROXIES_KEY });
  });

  it("deletes a proxy and refreshes the list", async () => {
    vi.mocked(proxiesApi.delete).mockResolvedValueOnce(undefined);
    const { wrapper, invalidate } = createWrapper();
    const { result } = renderHook(() => useDeleteProxy(), { wrapper });

    await act(() => result.current.mutateAsync("proxy-1"));

    expect(proxiesApi.delete).toHaveBeenCalledWith("proxy-1");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: PROXIES_KEY });
  });

  it("tests a proxy", async () => {
    const outcome = { success: true, testUrl: "https://github.com/", statusCode: 200, error: null };
    vi.mocked(proxiesApi.test).mockResolvedValueOnce(outcome);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTestProxy(), { wrapper });

    await expect(act(() => result.current.mutateAsync({ id: "proxy-1", dto }))).resolves.toEqual(outcome);
    expect(proxiesApi.test).toHaveBeenCalledWith("proxy-1", dto);
  });
});
