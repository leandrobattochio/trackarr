import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { whatsNewApi } from "@/features/whats-new/api";

export const WHATS_NEW_KEY = ["whats-new"] as const;

export function useWhatsNew() {
  return useQuery({
    queryKey: WHATS_NEW_KEY,
    queryFn: whatsNewApi.get,
  });
}

export function useMarkWhatsNewRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: whatsNewApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WHATS_NEW_KEY });
    },
  });
}
