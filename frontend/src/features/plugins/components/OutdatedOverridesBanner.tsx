import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { usePluginCatalog } from "@/features/plugins/hooks";
import { getOutdatedMessage, getOutdatedOverrides, getOutdatedReviewPath, getOutdatedToneClass } from "@/features/plugins/plugin-status";
import { cn } from "@/shared/lib/utils";

// No close button on purpose: the warning stays until the override is removed or updated.
export function OutdatedOverridesBanner({ className }: { className?: string }) {
  const { data: plugins = [] } = usePluginCatalog();
  const outdated = getOutdatedOverrides(plugins);

  if (outdated.length === 0) {
    return null;
  }

  return (
    <div role="alert" data-testid="outdated-overrides-banner" className={cn("space-y-2", className)}>
      {outdated.map((plugin) => (
        <div
          key={plugin.pluginId}
          data-testid={`outdated-override-${plugin.pluginId}`}
          data-highlighted={String(plugin.lastSyncFailed)}
          className={cn(
            "flex flex-col gap-2 rounded-xl border p-3 text-sm sm:flex-row sm:items-center sm:justify-between",
            getOutdatedToneClass(plugin.lastSyncFailed),
          )}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-semibold text-foreground">{plugin.displayName}</span>
              {" uses an outdated override. "}
              {getOutdatedMessage(plugin)}
              {plugin.lastSyncFailed && " Its last sync failed."}
            </p>
          </div>
          <Link
            to={getOutdatedReviewPath(plugin.pluginId)}
            className="shrink-0 font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Review {plugin.displayName} update
          </Link>
        </div>
      ))}
    </div>
  );
}
