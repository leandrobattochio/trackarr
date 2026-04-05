import { useQuery } from "@tanstack/react-query";
import { pluginApi } from "@/features/plugins/api";

export const MANAGE_PLUGINS_KEY = ["manage-plugins"] as const;

export function usePluginCatalog() {
  return useQuery({
    queryKey: MANAGE_PLUGINS_KEY,
    queryFn: pluginApi.list,
  });
}

export function usePluginDefinition(pluginId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...MANAGE_PLUGINS_KEY, pluginId],
    queryFn: () => pluginApi.getDefinition(pluginId),
    enabled,
  });
}
