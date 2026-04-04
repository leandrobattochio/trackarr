import { request } from "@/shared/api/http";
import type { ApiSnapshotsResponse, SnapshotFilters } from "@/features/snapshots/types";

export const snapshotsApi = {
  list: ({ integrationId, from, to }: SnapshotFilters) => {
    const params = new URLSearchParams({
      integrationId,
      from,
      to,
    });

    return request<ApiSnapshotsResponse>(`/snapshots?${params.toString()}`);
  },
};
