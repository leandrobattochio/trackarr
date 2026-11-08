import { ReorderableTracker, TrackerOrderControls } from "@/features/integrations/components/ReorderableTracker";
import { TrackerCard } from "@/features/integrations/components/TrackerCard";
import type { TrackerCollectionProps } from "@/features/integrations/components/tracker-collection";

export function TrackerCardGrid({ order }: TrackerCollectionProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="dashboard-cards-grid">
      {order.orderedIntegrations.map((tracker, index) => (
        <ReorderableTracker key={tracker.id} tracker={tracker} order={order} testId="tracker-card">
          <TrackerCard
            tracker={tracker}
            reorderControls={<TrackerOrderControls tracker={tracker} order={order} index={index} />}
          />
        </ReorderableTracker>
      ))}
    </div>
  );
}
