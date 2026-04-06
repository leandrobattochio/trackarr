import type { ReactNode } from "react";
import type { TrackerIntegration } from "@/features/integrations/types";
import { PluginTrackerCard } from "@/features/integrations/plugins";

interface TrackerCardProps {
  tracker: TrackerIntegration;
  reorderControls?: ReactNode;
}

export function TrackerCard({ tracker, reorderControls }: TrackerCardProps) {
  return <PluginTrackerCard tracker={tracker} reorderControls={reorderControls} />;
}
