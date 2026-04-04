import { useQuery } from "@tanstack/react-query";
import { snapshotsApi } from "@/features/snapshots/api";
import type { SnapshotFilters } from "@/features/snapshots/types";

export function useSnapshots(filters: SnapshotFilters, enabled: boolean) {
  return useQuery({
    queryKey: ["snapshots", filters.integrationId, filters.from, filters.to],
    queryFn: () => snapshotsApi.list(filters),
    enabled,
  });
}
