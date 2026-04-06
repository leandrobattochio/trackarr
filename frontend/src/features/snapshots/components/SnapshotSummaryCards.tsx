interface SnapshotSummaryCardsProps {
  count: number;
  firstSnapshotLabel: string;
  latestSnapshotLabel: string;
}

export function SnapshotSummaryCards({
  count,
  firstSnapshotLabel,
  latestSnapshotLabel,
}: SnapshotSummaryCardsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-md bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">Points</p>
        <p className="mt-1 font-display text-lg font-semibold">{count}</p>
      </div>
      <div className="rounded-md bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">First Snapshot</p>
        <p className="mt-1 text-sm font-medium">{firstSnapshotLabel}</p>
      </div>
      <div className="rounded-md bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">Latest Snapshot</p>
        <p className="mt-1 text-sm font-medium">{latestSnapshotLabel}</p>
      </div>
    </div>
  );
}
