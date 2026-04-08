import { useMemo, useState } from "react";
import { AlertCircle, Lock, Loader2, Unlock } from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { TrackerCard } from "@/features/integrations/components/TrackerCard";
import { StatsOverview } from "@/features/integrations/components/StatsOverview";
import { AddIntegrationDialog } from "@/features/integrations/components/AddIntegrationDialog";
import { useDashboardCardOrder } from "@/features/integrations/dashboard-order";
import { useIntegrations, usePlugins } from "@/features/integrations/hooks";
import { mapIntegration } from "@/features/integrations/types";
import { usePageTitle } from "@/shared/hooks/use-page-title";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    dropTargetSide,
    handleCardDragStart,
    handleCardDragOver,
    handleCardDrop,
    handleCardDragEnd,
  } = useDashboardCardOrder(integrations);

  const [isDragLocked, setIsDragLocked] = useState(true);

  const isLoading = intLoading || pluginsLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground" data-testid="dashboard-subtitle">
              {isDragLocked ? "Monitor your private tracker ratios" : "Edit mode — drag cards to reorder"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsDragLocked((prev) => !prev)}
                    aria-label={isDragLocked ? "Unlock card reordering" : "Lock card reordering"}
                    aria-pressed={!isDragLocked}
                    data-testid="drag-lock-toggle"
                    className={!isDragLocked ? "border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive" : ""}
                  >
                    {isDragLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent data-testid="drag-lock-tooltip">
                  {isDragLocked ? "Unlock to reorder cards" : "Lock card order"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
              <div
                className={[
                  "grid gap-4 md:grid-cols-2 xl:grid-cols-3 rounded-xl transition-[box-shadow,padding] duration-200",
                  !isDragLocked ? "ring-2 ring-destructive/60 shadow-[0_0_18px_-4px_hsl(var(--destructive)/0.45)] p-3" : "",
                ].join(" ")}
                data-testid="dashboard-cards-grid"
              >
                {orderedIntegrations.map((tracker) => (
                  <div
                    key={tracker.id}
                    draggable={!isDragLocked}
                    data-testid="tracker-card"
                    data-tracker-id={tracker.id}
                    data-plugin-id={tracker.pluginId}
                    data-drag-locked={isDragLocked || undefined}
                    onDragStart={(event) => {
                      if (isDragLocked) return;
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", tracker.id);
                      handleCardDragStart(tracker.id);
                    }}
                    onDragOver={(event) => {
                      if (isDragLocked) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      const side = event.clientX < rect.left + rect.width / 2 ? "before" : "after";
                      handleCardDragOver(event, tracker.id, side);
                    }}
                    onDrop={(event) => {
                      if (isDragLocked) return;
                      event.preventDefault();
                      const rect = event.currentTarget.getBoundingClientRect();
                      const side = event.clientX < rect.left + rect.width / 2 ? "before" : "after";
                      handleCardDrop(tracker.id, event.dataTransfer.getData("text/plain"), side);
                    }}
                    onDragEnd={() => {
                      if (isDragLocked) return;
                      handleCardDragEnd();
                    }}
                    className={[
                      "group relative transition-transform duration-200 ease-out",
                      !isDragLocked && draggedCardId === tracker.id
                        ? "tracker-card-dragging z-20 cursor-grabbing"
                        : !isDragLocked
                          ? "cursor-grab"
                          : "cursor-default",
                      !isDragLocked && dropTargetCardId === tracker.id && dropTargetSide === "before"
                        ? "tracker-card-drop-before"
                        : "",
                      !isDragLocked && dropTargetCardId === tracker.id && dropTargetSide === "after"
                        ? "tracker-card-drop-after"
                        : "",
                    ].join(" ")}
                  >
                    <TrackerCard tracker={tracker} />
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
