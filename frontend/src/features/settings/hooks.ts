import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/features/settings/api";
import type { ApiSettings } from "@/features/settings/types";

export const SETTINGS_KEY = ["settings"] as const;
export const SETTINGS_ABOUT_KEY = ["settings", "about"] as const;
export const SETTINGS_UPDATE_CHECK_KEY = ["settings", "update-check"] as const;

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: settingsApi.get,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Pick<ApiSettings, "userAgent" | "checkForUpdates">) => settingsApi.update(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      queryClient.invalidateQueries({ queryKey: SETTINGS_UPDATE_CHECK_KEY });
    },
  });
}

export function useAboutInfo() {
  return useQuery({
    queryKey: SETTINGS_ABOUT_KEY,
    queryFn: settingsApi.getAbout,
  });
}

export function useUpdateCheck() {
  return useQuery({
    queryKey: SETTINGS_UPDATE_CHECK_KEY,
    queryFn: settingsApi.getUpdateCheck,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}
