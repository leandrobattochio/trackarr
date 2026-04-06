import type { ReactNode } from "react";
import type { TrackerIntegration } from "@/features/integrations/types";
import { ConfiguredTrackerCard } from "@/features/integrations/plugins/ConfiguredTrackerCard";
import { MissingPluginTrackerCard } from "@/features/integrations/plugins/MissingPluginTrackerCard";

interface PluginTrackerCardProps {
  tracker: TrackerIntegration;
  reorderControls?: ReactNode;
}

export function PluginTrackerCard({ tracker, reorderControls }: PluginTrackerCardProps) {
  if (tracker.dashboard === null) {
    return <MissingPluginTrackerCard tracker={tracker} reorderControls={reorderControls} />;
  }

  return <ConfiguredTrackerCard tracker={tracker} reorderControls={reorderControls} />;
}
