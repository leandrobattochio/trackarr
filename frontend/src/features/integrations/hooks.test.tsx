import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  INTEGRATIONS_KEY,
  PLUGINS_KEY,
  useCreateIntegration,
  useDeleteIntegration,
  useIntegrations,
  usePlugins,
  useSyncIntegration,
  useUpdateIntegration,
} from "@/features/integrations/hooks";
import { api } from "@/features/integrations/api";

vi.mock("@/features/integrations/api", () => ({
  api: {
    integrations: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      sync: vi.fn(),
      delete: vi.fn(),
    },
    plugins: {
      list: vi.fn(),
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, wrapper };
}

describe("integration hooks", () => {
  it("loads integrations", async () => {
    vi.mocked(api.integrations.list).mockResolvedValueOnce([
      { id: "integration-1", name: "Alpha" },
    ] as never[]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIntegrations(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.integrations.list).toHaveBeenCalledOnce();
    expect(result.current.data).toEqual([{ id: "integration-1", name: "Alpha" }]);
  });

  it("filters plugins to valid dashboard entries", async () => {
    vi.mocked(api.plugins.list).mockResolvedValueOnce([
      { pluginId: "keep", definitionValid: true, dashboard: {}, displayName: "Keep" },
      { pluginId: "invalid", definitionValid: false, dashboard: {}, displayName: "Invalid" },
      { pluginId: "nodash", definitionValid: true, dashboard: null, displayName: "NoDash" },
    ] as never[]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePlugins(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      { pluginId: "keep", definitionValid: true, dashboard: {}, displayName: "Keep" },
    ]);
  });

  it("invalidates integration queries after create, update, sync, and delete mutations", async () => {
    vi.mocked(api.integrations.create).mockResolvedValue({} as never);
    vi.mocked(api.integrations.update).mockResolvedValue({} as never);
    vi.mocked(api.integrations.sync).mockResolvedValue({} as never);
    vi.mocked(api.integrations.delete).mockResolvedValue(undefined as never);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result: createResult } = renderHook(() => useCreateIntegration(), { wrapper });
    const { result: updateResult } = renderHook(() => useUpdateIntegration(), { wrapper });
    const { result: syncResult } = renderHook(() => useSyncIntegration(), { wrapper });
    const { result: deleteResult } = renderHook(() => useDeleteIntegration(), { wrapper });

    await createResult.current.mutateAsync({ name: "Tracker" } as never);
    await updateResult.current.mutateAsync({ id: "integration-1", dto: { name: "Updated" } as never });
    await syncResult.current.mutateAsync("integration-1");
    await deleteResult.current.mutateAsync("integration-1");

    expect(api.integrations.create).toHaveBeenCalledWith({ name: "Tracker" });
    expect(api.integrations.update).toHaveBeenCalledWith("integration-1", { name: "Updated" });
    expect(api.integrations.sync).toHaveBeenCalledWith("integration-1");
    expect(api.integrations.delete).toHaveBeenCalledWith("integration-1");
    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, { queryKey: INTEGRATIONS_KEY });
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, { queryKey: INTEGRATIONS_KEY });
    expect(invalidateSpy).toHaveBeenNthCalledWith(3, { queryKey: INTEGRATIONS_KEY });
    expect(invalidateSpy).toHaveBeenNthCalledWith(4, { queryKey: INTEGRATIONS_KEY });
    expect(PLUGINS_KEY).toEqual(["plugins"]);
  });
});
