import type { TrackerIntegration } from "@/features/integrations/types";
import { BjShareTrackerCard } from "@/features/integrations/plugins/bj-share/BjShareTrackerCard";
import { DefaultTrackerCard } from "@/features/integrations/plugins/default/DefaultTrackerCard";
import { Unit3DTrackerCard } from "@/features/integrations/plugins/unit3d/Unit3DTrackerCard";

interface PluginTrackerCardProps {
  tracker: TrackerIntegration;
}

export function PluginTrackerCard({ tracker }: PluginTrackerCardProps) {
  switch (tracker.pluginGroup) {
    case "bj-share":
      return <BjShareTrackerCard tracker={tracker} />;
    case "unit3d":
      return <Unit3DTrackerCard tracker={tracker} />;
    default:
      return <DefaultTrackerCard tracker={tracker} />;
  }
}
