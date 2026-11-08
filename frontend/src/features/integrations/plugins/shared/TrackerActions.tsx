import { Link } from "react-router-dom";
import { ChartLine, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EditIntegrationDialog } from "@/features/integrations/components/EditIntegrationDialog";
import { MetricTooltip } from "@/features/integrations/components/shared/MetricTooltip";
import type { TrackerIntegration } from "@/features/integrations/types";

export interface TrackerActionsProps {
  tracker: TrackerIntegration;
  actionsDisabled: boolean;
  isSyncing: boolean;
  isDeleting: boolean;
  onSync: () => void;
  onDelete: () => void;
  compact?: boolean;
}

export function TrackerActions({
  tracker,
  actionsDisabled,
  isSyncing,
  isDeleting,
  onSync,
  onDelete,
  compact = false,
}: TrackerActionsProps) {
  const syncDisabled = actionsDisabled || !tracker.configurationValid;
  const syncDescription = tracker.configurationValid
    ? "Fetch the latest tracker stats immediately instead of waiting for the next scheduled sync."
    : tracker.configurationError ?? "This integration no longer matches the current plugin definition and must be fixed before syncing.";

  return (
    <div className={compact ? "flex items-center gap-1" : "flex gap-2 pt-1"}>
      <MetricTooltip
        label="Sync Now"
        eyebrow="Manual Refresh"
        description={syncDescription}
      >
        <span className={compact ? "inline-flex" : "flex-1"}>
          <Button
            size="sm"
            variant={compact ? "ghost" : "outline"}
            className={compact ? undefined : "flex w-full"}
            onClick={onSync}
            disabled={syncDisabled}
            aria-label={compact ? "Sync now" : undefined}
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${compact ? (isSyncing ? "animate-spin" : "") : "mr-1.5"}`} />
            {!compact && (isSyncing ? "Syncing..." : "Sync")}
          </Button>
        </span>
      </MetricTooltip>
      <EditIntegrationDialog tracker={tracker} disabled={actionsDisabled} />
      <MetricTooltip
        label="View Snapshots"
        eyebrow="History"
        description="Open historical charts and trends for this tracker integration."
      >
        <span className="inline-flex">
          <Button
            size="sm"
            variant="ghost"
            asChild
            className={actionsDisabled ? "pointer-events-none opacity-50" : undefined}
          >
            <Link to={`/snapshots?integrationId=${tracker.id}`} aria-disabled={actionsDisabled} aria-label="View snapshots">
              <ChartLine className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </span>
      </MetricTooltip>
      <AlertDialog>
        <MetricTooltip
          label="Delete Integration"
          eyebrow="Danger Zone"
          description="Remove this tracker from TrackArr and delete its saved local configuration."
        >
          <AlertDialogTrigger asChild>
            <span className="inline-flex">
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={actionsDisabled}
                aria-label="Delete integration"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </span>
          </AlertDialogTrigger>
        </MetricTooltip>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete integration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {tracker.name} from TrackArr and delete its saved configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
