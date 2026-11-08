import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxiesApi } from "@/features/proxies/api";
import type { ProxyDto } from "@/features/proxies/types";

export const PROXIES_KEY = ["proxies"] as const;

export function useProxies() {
  return useQuery({ queryKey: PROXIES_KEY, queryFn: proxiesApi.list });
}

export function useSaveProxy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string | null; dto: ProxyDto }) =>
      id ? proxiesApi.update(id, dto) : proxiesApi.create(dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROXIES_KEY }),
  });
}

export function useDeleteProxy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => proxiesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROXIES_KEY }),
  });
}

export function useTestProxy() {
  return useMutation({
    mutationFn: ({ id, dto }: { id: string | null; dto: ProxyDto }) => proxiesApi.test(id, dto),
  });
}
