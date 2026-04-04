import type { TrackerIntegration } from "@/features/integrations/types";
import { PluginTrackerCard } from "@/features/integrations/plugins";

interface TrackerCardProps {
  tracker: TrackerIntegration;
}

export function TrackerCard({ tracker }: TrackerCardProps) {
  return <PluginTrackerCard tracker={tracker} />;
}
