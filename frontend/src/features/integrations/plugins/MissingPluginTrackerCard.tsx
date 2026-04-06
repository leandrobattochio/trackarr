import { AlertTriangle, Unplug } from "lucide-react";
import type { ReactNode } from "react";
import type { TrackerIntegration } from "@/features/integrations/types";
import { TrackerCardShell } from "@/features/integrations/plugins/shared/TrackerCardShell";
import { RatioThresholdCard } from "@/features/integrations/plugins/shared/RatioThresholdCard";

interface MissingPluginTrackerCardProps {
  tracker: TrackerIntegration;
  reorderControls?: ReactNode;
}

export function MissingPluginTrackerCard({ tracker, reorderControls }: MissingPluginTrackerCardProps) {
  return (
    <TrackerCardShell
      tracker={tracker}
      reorderControls={reorderControls}
      ratio={<RatioThresholdCard ratio={tracker.ratio} requiredRatio={tracker.requiredRatio} />}
      metrics={(
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-md border border-warning/30 bg-background/70 p-2 text-warning">
              <Unplug className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Plugin definition unavailable
              </div>
              <p className="text-muted-foreground">
                This integration still has saved stats, but its plugin is missing or no longer exposes dashboard metrics.
              </p>
              <p className="text-muted-foreground">
                {tracker.configurationError ?? `Plugin '${tracker.pluginId}' was not found.`}
              </p>
            </div>
          </div>
        </div>
      )}
    />
  );
}
