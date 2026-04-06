import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { settingsApi } from "@/features/settings/api";
import { SETTINGS_ABOUT_KEY, SETTINGS_KEY, useAboutInfo, useSettings, useUpdateSettings } from "@/features/settings/hooks";

vi.mock("@/features/settings/api", () => ({
  settingsApi: {
    get: vi.fn(),
    getAbout: vi.fn(),
    update: vi.fn(),
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

describe("settings hooks", () => {
  it("loads settings and about info", async () => {
    vi.mocked(settingsApi.get).mockResolvedValueOnce({ userAgent: "Trackarr/1.0" });
    vi.mocked(settingsApi.getAbout).mockResolvedValueOnce({
      version: "1.0.0",
      dotNetVersion: "9.0.0",
      runningInDocker: true,
      databaseEngine: "Sqlite",
      appliedMigrations: 3,
      appDataDirectory: "/app/data",
      startupDirectory: "/app",
      environmentName: "Production",
      uptime: "1 day",
    });

    const { wrapper } = createWrapper();
    const { result: settingsResult } = renderHook(() => useSettings(), { wrapper });
    const { result: aboutResult } = renderHook(() => useAboutInfo(), { wrapper });

    await waitFor(() => expect(settingsResult.current.isSuccess).toBe(true));
    await waitFor(() => expect(aboutResult.current.isSuccess).toBe(true));

    expect(settingsResult.current.data).toEqual({ userAgent: "Trackarr/1.0" });
    expect(aboutResult.current.data?.version).toBe("1.0.0");
    expect(SETTINGS_KEY).toEqual(["settings"]);
    expect(SETTINGS_ABOUT_KEY).toEqual(["settings", "about"]);
  });

  it("invalidates settings after a successful update", async () => {
    vi.mocked(settingsApi.update).mockResolvedValueOnce({ userAgent: "Updated" });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateSettings(), { wrapper });

    await result.current.mutateAsync("Updated");

    expect(settingsApi.update).toHaveBeenCalledWith("Updated");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SETTINGS_KEY });
  });
});
