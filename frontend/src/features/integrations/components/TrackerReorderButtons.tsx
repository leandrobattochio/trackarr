import type { MouseEvent } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TrackerReorderButtonsProps {
  trackerName: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
}

// Keeps the mouse down from starting a drag of the item around the buttons.
function stopDragStart(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export function TrackerReorderButtons({ trackerName, canMoveUp, canMoveDown, onMove }: TrackerReorderButtonsProps) {
  return (
    <div className="flex items-center gap-1" data-testid="tracker-card-reorder-controls">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label={`Move ${trackerName} up`}
        data-testid="tracker-card-move-up"
        disabled={!canMoveUp}
        onMouseDown={stopDragStart}
        onClick={(event) => {
          event.stopPropagation();
          onMove(-1);
        }}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label={`Move ${trackerName} down`}
        data-testid="tracker-card-move-down"
        disabled={!canMoveDown}
        onMouseDown={stopDragStart}
        onClick={(event) => {
          event.stopPropagation();
          onMove(1);
        }}
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
    </div>
  );
}
