import { ArrowDownToLine, ArrowUpFromLine, Coins, HardDrive, ShieldAlert } from "lucide-react";
import type { TrackerIntegration } from "@/features/integrations/types";
import { TrackerCardShell } from "@/features/integrations/plugins/shared/TrackerCardShell";
import { BytesMetricTile, CountMetricTile, TextMetricTile } from "@/features/integrations/plugins/shared/TrackerMetricTile";
import { RatioThresholdCard } from "@/features/integrations/plugins/shared/RatioThresholdCard";

interface Unit3DTrackerCardProps {
  tracker: TrackerIntegration;
}

export function Unit3DTrackerCard({ tracker }: Unit3DTrackerCardProps) {
  return (
    <TrackerCardShell
      tracker={tracker}
      ratio={<RatioThresholdCard ratio={tracker.ratio} requiredRatio={tracker.requiredRatio} />}
      metrics={(
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          <BytesMetricTile
            label="Uploaded"
            icon={ArrowUpFromLine}
            iconClassName="text-success"
            value={tracker.uploaded}
          />
          <BytesMetricTile
            label="Downloaded"
            icon={ArrowDownToLine}
            iconClassName="text-primary"
            value={tracker.downloaded}
          />
          <TextMetricTile
            label="Seed Bonus"
            icon={Coins}
            iconClassName="text-warning"
            value={tracker.seedBonus}
          />
          <TextMetricTile
            label="Buffer"
            icon={HardDrive}
            iconClassName="text-primary"
            value={tracker.buffer}
          />
          <CountMetricTile
            label="Hit & Runs"
            icon={ShieldAlert}
            iconClassName="text-destructive"
            value={tracker.hitAndRuns}
          />
        </div>
      )}
    />
  );
}
