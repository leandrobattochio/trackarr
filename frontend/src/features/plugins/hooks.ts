import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useCreatePluginDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (yaml: string) => pluginApi.createDefinition(yaml),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MANAGE_PLUGINS_KEY }),
  });
}

export function useUpdatePluginDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pluginId, yaml }: { pluginId: string; yaml: string }) => pluginApi.updateDefinition(pluginId, yaml),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: MANAGE_PLUGINS_KEY });
      queryClient.invalidateQueries({ queryKey: [...MANAGE_PLUGINS_KEY, variables.pluginId] });
    },
  });
}

export function useDeletePluginDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pluginId: string) => pluginApi.deleteDefinition(pluginId),
    onSuccess: (_, pluginId) => {
      queryClient.invalidateQueries({ queryKey: MANAGE_PLUGINS_KEY });
      queryClient.removeQueries({ queryKey: [...MANAGE_PLUGINS_KEY, pluginId] });
    },
  });
}
