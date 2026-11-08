import type { ReactNode } from "react";
import type { DashboardCardOrder } from "@/features/integrations/dashboard-order";
import type { TrackerIntegration } from "@/features/integrations/types";
import { TrackerReorderButtons } from "@/features/integrations/components/TrackerReorderButtons";
import { cn } from "@/shared/lib/utils";

interface ReorderableTrackerProps {
  tracker: TrackerIntegration;
  order: DashboardCardOrder;
  testId: string;
  className?: string;
  children: ReactNode;
}

export function ReorderableTracker({ tracker, order, testId, className, children }: ReorderableTrackerProps) {
  return (
    <div
      draggable
      data-testid={testId}
      data-tracker-id={tracker.id}
      data-plugin-id={tracker.pluginId}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", tracker.id);
        order.handleCardDragStart(tracker.id);
      }}
      onDragOver={(event) => order.handleCardDragOver(event, tracker.id)}
      onDrop={(event) => {
        event.preventDefault();
        order.handleCardDrop(tracker.id, event.dataTransfer.getData("text/plain"));
      }}
      onDragEnd={order.handleCardDragEnd}
      className={cn(
        "group relative transition-transform duration-200 ease-out",
        order.draggedCardId === tracker.id ? "tracker-card-dragging z-20 cursor-grabbing" : "cursor-grab",
        order.dropTargetCardId === tracker.id && "tracker-card-drop-target",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface TrackerOrderControlsProps {
  tracker: TrackerIntegration;
  order: DashboardCardOrder;
  index: number;
}

export function TrackerOrderControls({ tracker, order, index }: TrackerOrderControlsProps) {
  return (
    <TrackerReorderButtons
      trackerName={tracker.name}
      canMoveUp={index > 0}
      canMoveDown={index < order.orderedIntegrations.length - 1}
      onMove={(direction) => order.moveCard(tracker.id, direction)}
    />
  );
}
