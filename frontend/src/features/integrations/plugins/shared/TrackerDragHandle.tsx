import { GripVertical } from "lucide-react";

interface TrackerDragHandleProps {
  trackerName: string;
}

export function TrackerDragHandle({ trackerName }: TrackerDragHandleProps) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/20 text-muted-foreground"
      aria-label={`Drag to reorder ${trackerName}`}
      title="Drag to reorder"
    >
      <GripVertical className="h-4 w-4" />
    </div>
  );
}
