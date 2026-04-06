import type { SnapshotRangeKey } from "@/features/snapshots/range";

export interface ApiSnapshotItem {
  id: string;
  integrationId: string;
  capturedAt: string;
  uploadedBytes: number | null;
  downloadedBytes: number | null;
  seedBonus: string | null;
  buffer: string | null;
  hitAndRuns: number | null;
  ratio: number | null;
  requiredRatio: number | null;
  seedingTorrents: number | null;
  leechingTorrents: number | null;
  activeTorrents: number | null;
}

export interface ApiSnapshotsResponse {
  integrationId: string;
  range: SnapshotRangeKey;
  from: string | null;
  to: string | null;
  items: ApiSnapshotItem[];
}

export interface SnapshotFilters {
  integrationId: string;
  range: SnapshotRangeKey;
  from?: string;
  to?: string;
}
