import { ReorderableTracker, TrackerOrderControls } from "@/features/integrations/components/ReorderableTracker";
import { TrackerListRow } from "@/features/integrations/components/TrackerListRow";
import type { TrackerCollectionProps } from "@/features/integrations/components/tracker-collection";

// One entry per TrackerListRow cell; rows and header share these columns through subgrid.
const COLUMN_HEADERS = ["", "Tracker", "Ratio", "Uploaded", "Downloaded", "Last sync", "Status", ""];

export function TrackerList({ order }: TrackerCollectionProps) {
  return (
    <div
      className="divide-y divide-border/50 overflow-hidden rounded-lg border border-border/50 bg-card md:grid md:gap-x-4 md:grid-cols-[auto_minmax(10rem,2fr)_repeat(4,minmax(5.5rem,1fr))_auto_auto]"
      data-testid="dashboard-list"
    >
      <div
        className="hidden px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground md:col-span-full md:grid md:grid-cols-subgrid md:gap-x-4"
        aria-hidden="true"
      >
        {COLUMN_HEADERS.map((header, index) => <span key={index}>{header}</span>)}
      </div>
      {order.orderedIntegrations.map((tracker, index) => (
        <ReorderableTracker
          key={tracker.id}
          tracker={tracker}
          order={order}
          testId="tracker-row"
          className="md:col-span-full md:grid md:grid-cols-subgrid"
        >
          <TrackerListRow
            tracker={tracker}
            reorderControls={<TrackerOrderControls tracker={tracker} order={order} index={index} />}
          />
        </ReorderableTracker>
      ))}
    </div>
  );
}
