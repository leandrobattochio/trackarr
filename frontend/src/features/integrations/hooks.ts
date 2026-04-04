import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/features/integrations/api";
import type { CreateIntegrationDto, UpdateIntegrationDto } from "@/features/integrations/types";

export const INTEGRATIONS_KEY = ["integrations"] as const;
export const PLUGINS_KEY = ["plugins"] as const;

export function useIntegrations() {
  return useQuery({
    queryKey: INTEGRATIONS_KEY,
    queryFn: api.integrations.list,
  });
}

export function useCreateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateIntegrationDto) => api.integrations.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: INTEGRATIONS_KEY }),
  });
}

export function useUpdateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateIntegrationDto }) =>
      api.integrations.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: INTEGRATIONS_KEY }),
  });
}

export function useSyncIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.integrations.sync(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: INTEGRATIONS_KEY }),
  });
}

export function useDeleteIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.integrations.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: INTEGRATIONS_KEY }),
  });
}

export function usePlugins() {
  return useQuery({
    queryKey: PLUGINS_KEY,
    queryFn: api.plugins.list,
    staleTime: Infinity,
  });
}
