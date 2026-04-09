import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/features/settings/api";
import type { ApiSettings } from "@/features/settings/types";

export const SETTINGS_KEY = ["settings"] as const;
export const SETTINGS_ABOUT_KEY = ["settings", "about"] as const;

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
      queryClient.invalidateQueries({ queryKey: SETTINGS_ABOUT_KEY });
    },
  });
}

export function useAboutInfo() {
  return useQuery({
    queryKey: SETTINGS_ABOUT_KEY,
    queryFn: settingsApi.getAbout,
  });
}
