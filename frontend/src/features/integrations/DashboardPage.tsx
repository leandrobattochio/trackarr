import { useMemo, type ComponentType } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { StatsOverview } from "@/features/integrations/components/StatsOverview";
import { AddIntegrationDialog } from "@/features/integrations/components/AddIntegrationDialog";
import { DashboardViewToggle } from "@/features/integrations/components/DashboardViewToggle";
import { TrackerCardGrid } from "@/features/integrations/components/TrackerCardGrid";
import { TrackerList } from "@/features/integrations/components/TrackerList";
import type { TrackerCollectionProps } from "@/features/integrations/components/tracker-collection";
import { useDashboardCardOrder } from "@/features/integrations/dashboard-order";
import { useDashboardViewMode, type DashboardViewMode } from "@/features/integrations/dashboard-view-mode";
import { useIntegrations, usePlugins } from "@/features/integrations/hooks";
import { mapIntegration } from "@/features/integrations/types";
import { usePageTitle } from "@/shared/hooks/use-page-title";

const TRACKER_VIEWS: Record<DashboardViewMode, ComponentType<TrackerCollectionProps>> = {
  cards: TrackerCardGrid,
  list: TrackerList,
};

const DashboardPage = () => {
  usePageTitle("TrackArr | Dashboard");

  const { data: rawIntegrations = [], isLoading: intLoading, error: intError } = useIntegrations();
  const { data: plugins = [], isLoading: pluginsLoading } = usePlugins();

  const integrations = useMemo(
    () => rawIntegrations.map((i) => mapIntegration(i, plugins)),
    [rawIntegrations, plugins],
  );

  const addedPluginIds = integrations.map((i) => i.pluginId);
  const order = useDashboardCardOrder(integrations);
  const [viewMode, setViewMode] = useDashboardViewMode();
  const TrackerView = TRACKER_VIEWS[viewMode];

  const isLoading = intLoading || pluginsLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Monitor your private tracker ratios</p>
          </div>
          <div className="flex items-center gap-2">
            <DashboardViewToggle value={viewMode} onChange={setViewMode} />
            <AddIntegrationDialog addedPluginIds={addedPluginIds} />
          </div>
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
              <TrackerView order={order} />
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
