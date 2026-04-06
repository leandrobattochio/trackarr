import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { pluginApi } from "@/features/plugins/api";
import {
  MANAGE_PLUGINS_KEY,
  useCreatePluginDefinition,
  usePluginCatalog,
  usePluginDefinition,
  useUpdatePluginDefinition,
} from "@/features/plugins/hooks";

vi.mock("@/features/plugins/api", () => ({
  pluginApi: {
    list: vi.fn(),
    getDefinition: vi.fn(),
    createDefinition: vi.fn(),
    updateDefinition: vi.fn(),
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

describe("plugin hooks", () => {
  it("loads the plugin catalog and respects disabled definitions", async () => {
    vi.mocked(pluginApi.list).mockResolvedValueOnce([{ pluginId: "plugin-1" }] as never[]);
    vi.mocked(pluginApi.getDefinition).mockResolvedValueOnce("pluginId: plugin-1");

    const { wrapper } = createWrapper();
    const { result: catalogResult } = renderHook(() => usePluginCatalog(), { wrapper });
    const { result: disabledDefinitionResult } = renderHook(() => usePluginDefinition("plugin-1", false), { wrapper });
    const { result: enabledDefinitionResult } = renderHook(() => usePluginDefinition("plugin-1", true), { wrapper });

    await waitFor(() => expect(catalogResult.current.isSuccess).toBe(true));
    await waitFor(() => expect(enabledDefinitionResult.current.isSuccess).toBe(true));

    expect(catalogResult.current.data).toEqual([{ pluginId: "plugin-1" }]);
    expect(disabledDefinitionResult.current.fetchStatus).toBe("idle");
    expect(enabledDefinitionResult.current.data).toBe("pluginId: plugin-1");
    expect(pluginApi.getDefinition).toHaveBeenCalledTimes(1);
  });

  it("invalidates plugin queries after create and update mutations", async () => {
    vi.mocked(pluginApi.createDefinition).mockResolvedValueOnce({ pluginId: "plugin-1" } as never);
    vi.mocked(pluginApi.updateDefinition).mockResolvedValueOnce({ pluginId: "plugin-1" } as never);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result: createResult } = renderHook(() => useCreatePluginDefinition(), { wrapper });
    const { result: updateResult } = renderHook(() => useUpdatePluginDefinition(), { wrapper });

    await createResult.current.mutateAsync("pluginId: plugin-1");
    await updateResult.current.mutateAsync({ pluginId: "plugin-1", yaml: "displayName: Updated Plugin" });

    expect(pluginApi.createDefinition).toHaveBeenCalledWith("pluginId: plugin-1");
    expect(pluginApi.updateDefinition).toHaveBeenCalledWith("plugin-1", "displayName: Updated Plugin");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: MANAGE_PLUGINS_KEY });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [...MANAGE_PLUGINS_KEY, "plugin-1"] });
  });
});
