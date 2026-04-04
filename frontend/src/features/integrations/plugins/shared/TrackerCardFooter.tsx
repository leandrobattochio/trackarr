import { Link } from "react-router-dom";
import {
  Activity,
  ArrowDownCircle,
  ChartLine,
  Disc3,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

interface TrackerCardFooterProps {
  tracker: TrackerIntegration;
  actionsDisabled: boolean;
  isSyncing: boolean;
  isDeleting: boolean;
  onSync: () => void;
  onDelete: () => void;
}

interface FooterStatusChipProps {
  label: string;
  value: number | null;
  icon: LucideIcon;
  iconClassName: string;
  tooltipDescription: string;
}

function FooterStatusChip({
  label,
  value,
  icon: Icon,
  iconClassName,
  tooltipDescription,
}: FooterStatusChipProps) {
  return (
    <MetricTooltip
      label={label}
      eyebrow="Live Status"
      description={tooltipDescription}
    >
      <button
        type="button"
        className="group inline-flex cursor-default items-center gap-1.5 rounded-full border border-border/50 bg-muted/35 px-2.5 py-1 transition-all duration-200 hover:border-border/80 hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={label}
      >
        <Icon className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 ${iconClassName}`} aria-hidden="true" />
        <span className="font-medium text-foreground">{value ?? "--"}</span>
        <span className="text-muted-foreground">{label.toLowerCase()}</span>
      </button>
    </MetricTooltip>
  );
}

export function TrackerCardFooter({
  tracker,
  actionsDisabled,
  isSyncing,
  isDeleting,
  onSync,
  onDelete,
}: TrackerCardFooterProps) {
  return (
    <>
      <div className="space-y-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <FooterStatusChip
            label="Seeding"
            value={tracker.seedingTorrents}
            icon={Disc3}
            iconClassName="text-success"
            tooltipDescription="Torrents currently uploading to other peers from this tracker."
          />
          <FooterStatusChip
            label="Active"
            value={tracker.activeTorrents}
            icon={Activity}
            iconClassName="text-primary"
            tooltipDescription="Torrents currently doing work, including active downloading or uploading."
          />
          <FooterStatusChip
            label="Leeching"
            value={tracker.leechingTorrents}
            icon={ArrowDownCircle}
            iconClassName="text-warning"
            tooltipDescription="Torrents still downloading data and not yet fully seeded."
          />
        </div>
        <div className="grid grid-cols-1 gap-1 rounded-md bg-muted/40 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground/80">Last sync</span>
            <span className="font-medium text-foreground">
              {tracker.lastSync
                ? `${tracker.lastSync} (${tracker.lastSyncExact})`
                : "Never synced"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground/80">Next auto sync</span>
            <span className="font-medium text-foreground">
              {tracker.nextAutomaticSync
                ? `${tracker.nextAutomaticSync} (${tracker.nextAutomaticSyncExact})`
                : "Not scheduled"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <MetricTooltip
          label="Sync Now"
          eyebrow="Manual Refresh"
          description="Fetch the latest tracker stats immediately instead of waiting for the next scheduled sync."
        >
          <span className="flex-1">
            <Button
              size="sm"
              variant="outline"
              className="flex w-full"
              onClick={onSync}
              disabled={actionsDisabled}
            >
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
              {isSyncing ? "Syncing..." : "Sync"}
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
    </>
  );
}
