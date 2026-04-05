import type { TrackerIntegration } from "@/features/integrations/types";
import { ConfiguredTrackerCard } from "@/features/integrations/plugins/ConfiguredTrackerCard";

interface PluginTrackerCardProps {
  tracker: TrackerIntegration;
}

export function PluginTrackerCard({ tracker }: PluginTrackerCardProps) {
  return <ConfiguredTrackerCard tracker={tracker} />;
}
