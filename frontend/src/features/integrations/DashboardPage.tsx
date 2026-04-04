import { useMemo } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { TrackerCard } from "@/features/integrations/components/TrackerCard";
import { StatsOverview } from "@/features/integrations/components/StatsOverview";
import { AddIntegrationDialog } from "@/features/integrations/components/AddIntegrationDialog";
import { useIntegrations, usePlugins } from "@/features/integrations/hooks";
import { mapIntegration } from "@/features/integrations/types";
import { usePageTitle } from "@/shared/hooks/use-page-title";

const DashboardPage = () => {
  usePageTitle("TrackArr | Dashboard");

  const { data: rawIntegrations = [], isLoading: intLoading, error: intError } = useIntegrations();
  const { data: plugins = [], isLoading: pluginsLoading } = usePlugins();

  const integrations = useMemo(
    () => rawIntegrations.map((i) => mapIntegration(i, plugins)),
    [rawIntegrations, plugins],
  );

  const addedPluginIds = integrations.map((i) => i.pluginId);

  const isLoading = intLoading || pluginsLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Monitor your private tracker ratios</p>
          </div>
          <AddIntegrationDialog addedPluginIds={addedPluginIds} />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {intError && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Failed to load integrations: {intError.message}
          </div>
        )}

        {!isLoading && !intError && (
          <>
            <StatsOverview integrations={integrations} />

            {integrations.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No integrations yet. Add a tracker to get started.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {integrations.map((tracker) => (
                  <TrackerCard key={tracker.id} tracker={tracker} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
