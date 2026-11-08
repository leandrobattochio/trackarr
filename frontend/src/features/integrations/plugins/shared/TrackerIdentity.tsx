import { AlertTriangle, ExternalLink } from "lucide-react";
import { CardTitle } from "@/components/ui/card";
import { MetricTooltip } from "@/features/integrations/components/shared/MetricTooltip";
import { isBelowRequiredRatio } from "@/features/integrations/ratio";
import type { TrackerIntegration } from "@/features/integrations/types";

interface TrackerIdentityProps {
  tracker: TrackerIntegration;
  titleTestId: string;
  compact?: boolean;
}

export function TrackerIdentity({ tracker, titleTestId, compact = false }: TrackerIdentityProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={`flex shrink-0 items-center justify-center rounded-md bg-primary/10 font-display font-bold text-primary ${
          compact ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm"
        }`}
      >
        {tracker.name.substring(0, 2).toUpperCase()}
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        {compact
          ? <span className="truncate text-sm font-semibold" data-testid={titleTestId}>{tracker.name}</span>
          : <CardTitle className="text-base" data-testid={titleTestId}>{tracker.name}</CardTitle>}
        {isBelowRequiredRatio(tracker.ratio, tracker.requiredRatio) && (
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
  );
}
