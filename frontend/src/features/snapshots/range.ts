export const snapshotRangeOptions = [
  { key: "5m", label: "5 min" },
  { key: "15m", label: "15 min" },
  { key: "1h", label: "1 hour" },
  { key: "6h", label: "6 hours" },
  { key: "24h", label: "24 hours" },
  { key: "custom", label: "Custom" },
] as const;

export type SnapshotRangeKey = (typeof snapshotRangeOptions)[number]["key"];

export const defaultSnapshotRange: SnapshotRangeKey = "1h";

export function isSnapshotRangeKey(value: string | null | undefined): value is SnapshotRangeKey {
  return snapshotRangeOptions.some((option) => option.key === value);
}

export function formatSnapshotRangeLabel(range: SnapshotRangeKey, from?: string, to?: string) {
  if (range !== "custom")
    return snapshotRangeOptions.find((option) => option.key === range)?.label ?? range;

  if (from && to)
    return `${from} to ${to}`;

  return "Custom range";
}
