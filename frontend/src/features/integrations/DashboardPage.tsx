import { useMemo } from "react";
import { ArrowDown, ArrowUp, Loader2, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { TrackerCard } from "@/features/integrations/components/TrackerCard";
import { StatsOverview } from "@/features/integrations/components/StatsOverview";
import { AddIntegrationDialog } from "@/features/integrations/components/AddIntegrationDialog";
import { useDashboardCardOrder } from "@/features/integrations/dashboard-order";
import { useIntegrations, usePlugins } from "@/features/integrations/hooks";
import { mapIntegration } from "@/features/integrations/types";
import { usePageTitle } from "@/shared/hooks/use-page-title";
import { Button } from "@/components/ui/button";

const DashboardPage = () => {
  usePageTitle("TrackArr | Dashboard");

  const { data: rawIntegrations = [], isLoading: intLoading, error: intError } = useIntegrations();
  const { data: plugins = [], isLoading: pluginsLoading } = usePlugins();

  const integrations = useMemo(
    () => rawIntegrations.map((i) => mapIntegration(i, plugins)),
    [rawIntegrations, plugins],
  );

  const addedPluginIds = integrations.map((i) => i.pluginId);
  const {
    orderedIntegrations,
    draggedCardId,
    dropTargetCardId,
    handleCardDragStart,
    handleCardDragOver,
    handleCardDrop,
    handleCardDragEnd,
    moveCard,
  } = useDashboardCardOrder(integrations);

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
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="dashboard-cards-grid">
                {orderedIntegrations.map((tracker, index) => (
                  <div
                    key={tracker.id}
                    draggable
                    data-testid="tracker-card"
                    data-tracker-id={tracker.id}
                    data-plugin-id={tracker.pluginId}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", tracker.id);
                      handleCardDragStart(tracker.id);
                    }}
                    onDragOver={(event) => handleCardDragOver(event, tracker.id)}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleCardDrop(tracker.id, event.dataTransfer.getData("text/plain"));
                    }}
                    onDragEnd={handleCardDragEnd}
                    className={[
                      "group relative transition-transform duration-200 ease-out",
                      draggedCardId === tracker.id
                        ? "tracker-card-dragging z-20 cursor-grabbing"
                        : "cursor-grab",
                      dropTargetCardId === tracker.id
                        ? "tracker-card-drop-target"
                        : "",
                    ].join(" ")}
                  >
                    <TrackerCard
                      tracker={tracker}
                      reorderControls={(
                        <div className="flex items-center gap-1" data-testid="tracker-card-reorder-controls">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Move ${tracker.name} up`}
                            data-testid="tracker-card-move-up"
                            disabled={index === 0}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              moveCard(tracker.id, -1);
                            }}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Move ${tracker.name} down`}
                            data-testid="tracker-card-move-down"
                            disabled={index === orderedIntegrations.length - 1}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              moveCard(tracker.id, 1);
                            }}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    />
                  </div>
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
