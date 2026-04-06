import { request } from "@/shared/api/http";
import type { ApiSnapshotsResponse, SnapshotFilters } from "@/features/snapshots/types";

export const snapshotsApi = {
  list: ({ integrationId, range, from, to }: SnapshotFilters) => {
    const params = new URLSearchParams({
      integrationId,
      range,
    });

    if (range === "custom") {
      if (from)
        params.set("from", from);

      if (to)
        params.set("to", to);
    }

    return request<ApiSnapshotsResponse>(`/snapshots?${params.toString()}`);
  },
};
