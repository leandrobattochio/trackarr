import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { INTEGRATION_STAT_DEFINITIONS, SNAPSHOT_CHART_STAT_KEYS } from "@/features/integrations/stats";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePageTitle } from "@/shared/hooks/use-page-title";

const integrationFlow = [
  {
    title: "1. Add a tracker",
    detail: "Use Add Tracker on the dashboard and choose a plugin from the catalog.",
  },
  {
    title: "2. Fill the generated form",
    detail: "Fields come from the selected plugin definition. Required fields are enforced by the form and backend validation.",
  },
  {
    title: "3. Sync and monitor",
    detail: "Each card shows a ratio panel, plugin metric tiles, status badge, activity chips, last sync, next auto sync, and actions.",
  },
  {
    title: "4. Review history",
    detail: "Open Snapshots from the card footer or sidebar to inspect transfer and torrent activity over time.",
  },
];

const pluginFacts = [
  "Plugin definitions are YAML files loaded from disk.",
  "New Plugin starts from a commented template and creates a new physical YAML file.",
  "Save writes changes back to the selected plugin file on disk.",
  "Invalid plugin YAML is surfaced in the plugin editor with the backend validation error.",
];

export default function HelpPage() {
  usePageTitle("TrackArr | Help");

  const snapshotStoredOnly = INTEGRATION_STAT_DEFINITIONS.filter(
    (stat) => stat.snapshotStored && !stat.snapshotCharted,
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Help</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            This page documents the UI that exists today. It is intentionally tied to the current integration stats,
            snapshot charts, and disk-backed plugin workflow.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Working With Integrations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              {integrationFlow.map((step) => (
                <div key={step.title} className="space-y-1">
                  <p className="font-medium text-foreground">{step.title}</p>
                  <p>{step.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Dashboard Behavior</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                The overview tiles summarize total uploaded, total downloaded, average ratio, and active torrent count
                across all configured integrations.
              </p>
              <p>
                Each tracker card has a shared shell, but the metric grid is plugin-defined. That means different
                trackers can show different metric combinations while keeping the same status and action layout.
              </p>
              <p>
                Ratio warnings are driven by current ratio versus required ratio. Integrations can also be marked as
                needing fixing when their saved payload no longer matches the current plugin definition.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Current System Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These are the stat keys currently supported by the frontend and backend dashboard/snapshot model.
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {INTEGRATION_STAT_DEFINITIONS.map((stat) => (
                <div key={stat.key} className="rounded-lg border border-border/50 bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{stat.label}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{stat.key}</p>
                    </div>
                    <span className="rounded-full border border-border/60 px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {stat.format}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{stat.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Snapshots</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                The snapshots page currently charts these series:
                {" "}
                <span className="font-medium text-foreground">{SNAPSHOT_CHART_STAT_KEYS.join(", ")}</span>.
              </p>
              <p>
                These fields are still stored in snapshots but are not charted in the current UI:
                {" "}
                <span className="font-medium text-foreground">
                  {snapshotStoredOnly.map((stat) => stat.key).join(", ")}
                </span>.
              </p>
              <p>
                That mismatch is real. The data model is broader than the current chart surface.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Plugin Workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pluginFacts.map((fact) => (
                <p key={fact} className="text-sm text-muted-foreground">{fact}</p>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Refactor Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The previous page had stale plugin-management text because it duplicated behavior descriptions instead of
              staying anchored to the current implementation.
            </p>
            <p>
              The page itself does not need a major architectural refactor. It needs stricter scope: only document
              behavior that is visible in the current frontend and supported by the current API contracts.
            </p>
            <p>
              The shared stat catalog is worth keeping because it removes one source of drift. The plugin-management
              copy should stay simple and literal unless more plugin metadata is exposed by the UI or API.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
