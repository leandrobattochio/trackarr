import { ArrowDownToLine, ArrowUpFromLine, Coins } from "lucide-react";
import type { TrackerIntegration } from "@/features/integrations/types";
import { TrackerCardShell } from "@/features/integrations/plugins/shared/TrackerCardShell";
import { BytesMetricTile, TextMetricTile } from "@/features/integrations/plugins/shared/TrackerMetricTile";
import { RatioThresholdCard } from "@/features/integrations/plugins/shared/RatioThresholdCard";

interface BjShareTrackerCardProps {
  tracker: TrackerIntegration;
}

export function BjShareTrackerCard({ tracker }: BjShareTrackerCardProps) {
  return (
    <TrackerCardShell
      tracker={tracker}
      ratio={<RatioThresholdCard ratio={tracker.ratio} requiredRatio={tracker.requiredRatio} />}
      metrics={(
        <div className="grid grid-cols-3 gap-3">
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
        </div>
      )}
    />
  );
}
