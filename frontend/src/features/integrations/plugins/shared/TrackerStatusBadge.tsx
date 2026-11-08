import { AlertTriangle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { IntegrationStatus, TrackerIntegration } from "@/features/integrations/types";

interface TrackerStatusBadgeProps {
  tracker: TrackerIntegration;
  isSyncing: boolean;
}

function getStatusBadgeVariant(status: IntegrationStatus): "default" | "secondary" | "destructive" {
  if (status === "success") return "default";
  if (status === "pending") return "secondary";
  return "destructive";
}

export function TrackerStatusBadge({ tracker, isSyncing }: TrackerStatusBadgeProps) {
  const needsConfigurationFix = !tracker.configurationValid;
  const showsWarning = needsConfigurationFix || tracker.status === "authFailed" || tracker.status === "unknownError";

  return (
    <Badge variant={needsConfigurationFix ? "destructive" : getStatusBadgeVariant(tracker.status)}>
      {isSyncing && <RefreshCw className="mr-1 h-3 w-3 animate-spin" />}
      {showsWarning && <AlertTriangle className="mr-1 h-3 w-3" />}
      {needsConfigurationFix ? "needs fixing" : tracker.statusLabel}
    </Badge>
  );
}
