import type { ReactNode } from "react";
import { getRatioColor, isBelowRequiredRatio, isInfiniteRatio } from "@/features/integrations/ratio";
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
    <div className="flex min-w-0 flex-col text-sm md:block">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground md:hidden">{label}</span>
      {children}
    </div>
  );
}

function formatOptionalBytes(value: number | null, unitSystem: ByteUnitSystem) {
  return value === null ? "--" : formatBytes(value, unitSystem);
}

function RatioValue({ ratio, requiredRatio, downloaded }: Pick<TrackerIntegration, "ratio" | "requiredRatio" | "downloaded">) {
  const infinite = isInfiniteRatio(ratio, downloaded);

  return (
    <span className="whitespace-nowrap">
      <span className={cn("font-display font-semibold", infinite ? "text-success" : ratio === null ? "text-muted-foreground" : getRatioColor(ratio))}>
        {infinite ? "∞" : ratio === null ? "--" : ratio.toFixed(2)}
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
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 transition-colors hover:bg-muted/30",
        "md:col-span-full md:grid-cols-subgrid md:gap-x-4",
        isBelowRequiredRatio(tracker.ratio, tracker.requiredRatio) && "bg-destructive/5",
      )}
    >
      <div className="flex items-center gap-1">
        <TrackerDragHandle trackerName={tracker.name} />
        {reorderControls}
      </div>
      <div className="col-span-2 min-w-0 md:col-span-1">
        <TrackerIdentity tracker={tracker} titleTestId="tracker-row-title" compact />
        {!tracker.configurationValid && (
          <p className="mt-0.5 truncate text-xs text-warning sm:pl-11" title={tracker.configurationError ?? undefined}>
            {tracker.configurationError ?? "Integration needs fixing"}
          </p>
        )}
      </div>
      {/* On phones the values get a row of their own; from md up they are cells of the list's columns. */}
      <div className="col-span-full grid grid-cols-2 gap-3 min-[480px]:grid-cols-4 md:contents">
        <ListCell label="Ratio">
          <RatioValue ratio={tracker.ratio} requiredRatio={tracker.requiredRatio} downloaded={tracker.downloaded} />
        </ListCell>
        <ListCell label="Uploaded">{formatOptionalBytes(tracker.uploaded, tracker.byteUnitSystem)}</ListCell>
        <ListCell label="Downloaded">{formatOptionalBytes(tracker.downloaded, tracker.byteUnitSystem)}</ListCell>
        <ListCell label="Last sync">
          <span title={tracker.lastSyncExact ?? undefined}>{tracker.lastSync ?? "Never"}</span>
        </ListCell>
      </div>
      <div className="col-span-2 md:col-span-1">
        <TrackerStatusBadge tracker={tracker} isSyncing={actions.isSyncing} />
      </div>
      <div className="justify-self-end md:justify-self-start">
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
    </div>
  );
}
