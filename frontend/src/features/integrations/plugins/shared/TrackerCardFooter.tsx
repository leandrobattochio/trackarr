import { Activity, AlertTriangle, ArrowDownCircle, Disc3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MetricTooltip } from "@/features/integrations/components/shared/MetricTooltip";
import { TrackerActions, type TrackerActionsProps } from "@/features/integrations/plugins/shared/TrackerActions";

type TrackerCardFooterProps = Omit<TrackerActionsProps, "compact">;

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
        className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-border/50 bg-muted/35 px-2.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={label}
      >
        <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClassName}`} aria-hidden="true" />
        <span className="font-medium text-foreground">{value ?? "--"}</span>
        <span className="text-muted-foreground">{label.toLowerCase()}</span>
      </button>
    </MetricTooltip>
  );
}

export function TrackerCardFooter(props: TrackerCardFooterProps) {
  const { tracker } = props;

  return (
    <>
      <div className="space-y-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
        {!tracker.configurationValid && (
          <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Integration needs fixing</p>
                <p>{tracker.configurationError ?? "This integration no longer matches the current plugin definition."}</p>
              </div>
            </div>
          </div>
        )}
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

      <TrackerActions {...props} />
    </>
  );
}
