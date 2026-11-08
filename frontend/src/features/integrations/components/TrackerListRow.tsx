import type { ReactNode } from "react";
import { getRatioColor, isBelowRequiredRatio } from "@/features/integrations/ratio";
import type { TrackerIntegration } from "@/features/integrations/types";
import { TrackerActions } from "@/features/integrations/plugins/shared/TrackerActions";
import { TrackerDragHandle } from "@/features/integrations/plugins/shared/TrackerDragHandle";
import { TrackerIdentity } from "@/features/integrations/plugins/shared/TrackerIdentity";
import { TrackerStatusBadge } from "@/features/integrations/plugins/shared/TrackerStatusBadge";
import { useTrackerCardActions } from "@/features/integrations/plugins/shared/useTrackerCardActions";
import { formatBytes, type ByteUnitSystem } from "@/shared/lib/formatters";
import { cn } from "@/shared/lib/utils";

interface TrackerListRowProps {
  tracker: TrackerIntegration;
  reorderControls: ReactNode;
}

interface ListCellProps {
  label: string;
  children: ReactNode;
}

function ListCell({ label, children }: ListCellProps) {
  return (
    <div className="flex flex-col text-sm md:block">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground md:hidden">{label}</span>
      {children}
    </div>
  );
}

function formatOptionalBytes(value: number | null, unitSystem: ByteUnitSystem) {
  return value === null ? "--" : formatBytes(value, unitSystem);
}

function RatioValue({ ratio, requiredRatio }: Pick<TrackerIntegration, "ratio" | "requiredRatio">) {
  return (
    <span className="whitespace-nowrap">
      <span className={cn("font-display font-semibold", ratio === null ? "text-muted-foreground" : getRatioColor(ratio))}>
        {ratio === null ? "--" : ratio.toFixed(2)}
      </span>
      {requiredRatio !== null && (
        <span className="text-xs text-muted-foreground"> / {requiredRatio.toFixed(2)}</span>
      )}
    </span>
  );
}

export function TrackerListRow({ tracker, reorderControls }: TrackerListRowProps) {
  const actions = useTrackerCardActions(tracker);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 transition-colors hover:bg-muted/30",
        "md:col-span-full md:grid md:grid-cols-subgrid",
        isBelowRequiredRatio(tracker.ratio, tracker.requiredRatio) && "bg-destructive/5",
      )}
    >
      <div className="flex items-center gap-1">
        <TrackerDragHandle trackerName={tracker.name} />
        {reorderControls}
      </div>
      <div className="min-w-0 flex-1 basis-48">
        <TrackerIdentity tracker={tracker} titleTestId="tracker-row-title" compact />
        {!tracker.configurationValid && (
          <p className="mt-0.5 truncate pl-11 text-xs text-warning" title={tracker.configurationError ?? undefined}>
            {tracker.configurationError ?? "Integration needs fixing"}
          </p>
        )}
      </div>
      <ListCell label="Ratio">
        <RatioValue ratio={tracker.ratio} requiredRatio={tracker.requiredRatio} />
      </ListCell>
      <ListCell label="Uploaded">{formatOptionalBytes(tracker.uploaded, tracker.byteUnitSystem)}</ListCell>
      <ListCell label="Downloaded">{formatOptionalBytes(tracker.downloaded, tracker.byteUnitSystem)}</ListCell>
      <ListCell label="Last sync">
        <span title={tracker.lastSyncExact ?? undefined}>{tracker.lastSync ?? "Never"}</span>
      </ListCell>
      <div>
        <TrackerStatusBadge tracker={tracker} isSyncing={actions.isSyncing} />
      </div>
      <TrackerActions
        tracker={tracker}
        actionsDisabled={actions.actionsDisabled}
        isSyncing={actions.isSyncing}
        isDeleting={actions.isDeleting}
        onSync={actions.handleSync}
        onDelete={actions.handleDelete}
        compact
      />
    </div>
  );
}
