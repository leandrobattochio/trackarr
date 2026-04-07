import {
  AlertTriangle,
  ExternalLink,
  GripVertical,
  RefreshCw,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricTooltip } from "@/features/integrations/components/shared/MetricTooltip";
import type { TrackerIntegration } from "@/features/integrations/types";
import { TrackerCardFooter } from "@/features/integrations/plugins/shared/TrackerCardFooter";
import { useTrackerCardActions } from "@/features/integrations/plugins/shared/useTrackerCardActions";

interface TrackerCardShellProps {
  tracker: TrackerIntegration;
  metrics: ReactNode;
  ratio: ReactNode;
  reorderControls?: ReactNode;
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "success") return "default";
  if (status === "pending") return "secondary";
  return "destructive";
}

export function TrackerCardShell({ tracker, metrics, ratio, reorderControls }: TrackerCardShellProps) {
  const { actionsDisabled, handleDelete, handleSync, isDeleting, isSyncing } = useTrackerCardActions(tracker);
  const needsConfigurationFix = !tracker.configurationValid;
  const isBelowRequiredRatio =
    tracker.ratio !== null &&
    tracker.requiredRatio !== null &&
    tracker.ratio < tracker.requiredRatio;

  return (
    <Card
      className={`border-border/50 transition-[border-color,box-shadow,background-color] hover:border-primary/30 ${
        isBelowRequiredRatio
          ? "bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.12),_transparent_58%)] shadow-[0_0_0_1px_rgba(239,68,68,0.22),0_18px_40px_-28px_rgba(239,68,68,0.45)]"
          : ""
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/20 text-muted-foreground"
              aria-label={`Drag to reorder ${tracker.name}`}
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </div>
            {reorderControls}
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 font-display text-sm font-bold text-primary">
              {tracker.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-base" data-testid="tracker-card-title">{tracker.name}</CardTitle>
                {isBelowRequiredRatio && (
                  <MetricTooltip
                    label="Ratio Warning"
                    eyebrow="Take Action"
                    description="Downloads may be blocked and the account could be lost if the ratio stays below the required minimum."
                  >
                    <button
                      type="button"
                      className="inline-flex cursor-default items-center justify-center rounded-full border border-warning/30 bg-warning/10 p-1 text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label="Ratio warning details"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </button>
                  </MetricTooltip>
                )}
                {tracker.url && (
                  <a
                    href={tracker.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground transition-colors hover:text-primary"
                    aria-label={`Open ${tracker.name}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
          <Badge variant={needsConfigurationFix ? "destructive" : getStatusBadgeVariant(tracker.status)}>
            {isSyncing && <RefreshCw className="mr-1 h-3 w-3 animate-spin" />}
            {(needsConfigurationFix || tracker.status === "authFailed" || tracker.status === "unknownError") && <AlertTriangle className="mr-1 h-3 w-3" />}
            {needsConfigurationFix ? "needs fixing" : tracker.statusLabel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>{ratio}</div>

        {metrics}
        <TrackerCardFooter
          tracker={tracker}
          actionsDisabled={actionsDisabled}
          isSyncing={isSyncing}
          isDeleting={isDeleting}
          onSync={handleSync}
          onDelete={handleDelete}
        />
      </CardContent>
    </Card>
  );
}
