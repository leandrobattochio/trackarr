import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { isBelowRequiredRatio } from "@/features/integrations/ratio";
import type { TrackerIntegration } from "@/features/integrations/types";
import { TrackerCardFooter } from "@/features/integrations/plugins/shared/TrackerCardFooter";
import { TrackerDragHandle } from "@/features/integrations/plugins/shared/TrackerDragHandle";
import { TrackerIdentity } from "@/features/integrations/plugins/shared/TrackerIdentity";
import { TrackerStatusBadge } from "@/features/integrations/plugins/shared/TrackerStatusBadge";
import { useTrackerCardActions } from "@/features/integrations/plugins/shared/useTrackerCardActions";

interface TrackerCardShellProps {
  tracker: TrackerIntegration;
  metrics: ReactNode;
  ratio: ReactNode;
  reorderControls?: ReactNode;
}

export function TrackerCardShell({ tracker, metrics, ratio, reorderControls }: TrackerCardShellProps) {
  const actions = useTrackerCardActions(tracker);

  return (
    <Card
      className={`border-border/50 transition-[border-color,box-shadow,background-color] hover:border-primary/30 ${
        isBelowRequiredRatio(tracker.ratio, tracker.requiredRatio)
          ? "bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.12),_transparent_58%)] shadow-[0_0_0_1px_rgba(239,68,68,0.22),0_18px_40px_-28px_rgba(239,68,68,0.45)]"
          : ""
      }`}
    >
      <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <TrackerDragHandle trackerName={tracker.name} />
            {reorderControls}
            <TrackerIdentity tracker={tracker} titleTestId="tracker-card-title" />
          </div>
          <div className="shrink-0">
            <TrackerStatusBadge tracker={tracker} isSyncing={actions.isSyncing} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
        <div>{ratio}</div>

        {metrics}
        <TrackerCardFooter
          tracker={tracker}
          actionsDisabled={actions.actionsDisabled}
          isSyncing={actions.isSyncing}
          isDeleting={actions.isDeleting}
          onSync={actions.handleSync}
          onDelete={actions.handleDelete}
        />
      </CardContent>
    </Card>
  );
}
