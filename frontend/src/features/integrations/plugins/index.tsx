import type { TrackerIntegration } from "@/features/integrations/types";
import { ConfiguredTrackerCard } from "@/features/integrations/plugins/ConfiguredTrackerCard";
import { MissingPluginTrackerCard } from "@/features/integrations/plugins/MissingPluginTrackerCard";

interface PluginTrackerCardProps {
  tracker: TrackerIntegration;
}

export function PluginTrackerCard({ tracker }: PluginTrackerCardProps) {
  if (tracker.dashboard === null) {
    return <MissingPluginTrackerCard tracker={tracker} />;
  }

  return <ConfiguredTrackerCard tracker={tracker} />;
}
