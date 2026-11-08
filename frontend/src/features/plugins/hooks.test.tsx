import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { pluginApi } from "@/features/plugins/api";
import {
  MANAGE_PLUGINS_KEY,
  useCreatePluginDefinition,
  useDeleteCustomPlugin,
  useDeletePluginOverride,
  usePluginCatalog,
  useTestPlugin,
  usePluginDiff,
  usePluginDefinition,
  useUpdatePluginDefinition,
} from "@/features/plugins/hooks";

vi.mock("@/features/plugins/api", () => ({
  pluginApi: {
    list: vi.fn(),
    getDefinition: vi.fn(),
    createDefinition: vi.fn(),
    updateDefinition: vi.fn(),
    getDiff: vi.fn(),
    deleteOverride: vi.fn(),
    deleteCustom: vi.fn(),
    test: vi.fn(),
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

  it("loads a plugin diff only when enabled", async () => {
    vi.mocked(pluginApi.getDiff).mockResolvedValueOnce({ pluginId: "plugin-1" } as never);

    const { wrapper } = createWrapper();
    const { result: disabled } = renderHook(() => usePluginDiff("plugin-0", false), { wrapper });
    const { result: enabled } = renderHook(() => usePluginDiff("plugin-1", true), { wrapper });

    await waitFor(() => expect(enabled.current.isSuccess).toBe(true));
    expect(enabled.current.data).toEqual({ pluginId: "plugin-1" });
    expect(disabled.current.fetchStatus).toBe("idle");
    expect(pluginApi.getDiff).toHaveBeenCalledWith("plugin-1");
    expect(pluginApi.getDiff).toHaveBeenCalledTimes(1);
  });

  it("invalidates every plugin query after deleting an override", async () => {
    vi.mocked(pluginApi.deleteOverride).mockResolvedValueOnce(undefined);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useDeletePluginOverride(), { wrapper });

    await result.current.mutateAsync("plugin-1");

    expect(pluginApi.deleteOverride).toHaveBeenCalledWith("plugin-1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: MANAGE_PLUGINS_KEY });
  });

  it("deletes a custom plugin, drops its definition and refreshes the catalog", async () => {
    vi.mocked(pluginApi.deleteCustom).mockResolvedValueOnce(undefined);

    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData([...MANAGE_PLUGINS_KEY, "my-tracker"], "pluginId: my-tracker");
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useDeleteCustomPlugin(), { wrapper });

    await result.current.mutateAsync("my-tracker");

    expect(pluginApi.deleteCustom).toHaveBeenCalledWith("my-tracker");
    expect(queryClient.getQueryData([...MANAGE_PLUGINS_KEY, "my-tracker"])).toBeUndefined();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: MANAGE_PLUGINS_KEY });
  });

  it("runs a dry run without invalidating any plugin query", async () => {
    vi.mocked(pluginApi.test).mockResolvedValueOnce({ outcome: "success" } as never);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useTestPlugin(), { wrapper });

    await expect(result.current.mutateAsync({ integrationId: "integration-1", useOfficial: true })).resolves.toEqual({ outcome: "success" });

    expect(pluginApi.test).toHaveBeenCalledWith({ integrationId: "integration-1", useOfficial: true }, expect.anything());
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
