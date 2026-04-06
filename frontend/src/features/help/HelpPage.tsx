import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePageTitle } from "@/shared/hooks/use-page-title";

const navigationSections = [
  {
    title: "Dashboard",
    detail:
      "View your configured tracker integrations, overall portfolio totals, sync status, ratio warnings, and quick actions for each tracker card.",
  },
  {
    title: "Snapshots",
    detail:
      "Open historical charts for a specific integration, change the time range, and toggle transfer or torrent-count series on and off.",
  },
  {
    title: "Manage Plugins",
    detail:
      "Inspect plugin YAML definitions, create database-backed plugin drafts, save overrides for disk plugins, and delete database definitions when needed.",
  },
  {
    title: "Help",
    detail:
      "Use this page as the reference for how integrations, plugin definitions, scheduled syncs, and dashboard metrics work together.",
  },
];

const integrationNotes = [
  {
    name: "Plugin-driven forms",
    detail:
      "The Add Tracker and Edit dialogs are generated from the selected plugin definition, so each tracker can request a different set of fields.",
  },
  {
    name: "Required fields",
    detail:
      "Fields marked with an asterisk must be filled before the integration can be saved or updated.",
  },
  {
    name: "Sensitive values",
    detail:
      "Passwords and other sensitive fields are masked in edit mode. Re-enter them only when the saved value needs to change.",
  },
  {
    name: "Cron schedules",
    detail:
      "Cron inputs use Hangfire cron syntax in UTC. The built-in form hint shows the expected format, for example `0 * * * *` for hourly syncs.",
  },
];

const pluginNotes = [
  {
    name: "Disk vs database definitions",
    detail:
      "The plugin catalog shows whether the active definition comes from disk or the database. Saving a disk plugin from the editor creates a database override.",
  },
  {
    name: "Drafting new plugins",
    detail:
      "New Plugin opens a starter YAML template so you can define metadata, fields, sync steps, mappings, and dashboard metric blocks.",
  },
  {
    name: "YAML validation",
    detail:
      "Plugin YAML is validated by the backend when you save. If the definition is invalid, the returned error is shown above the editor.",
  },
  {
    name: "Deleting overrides",
    detail:
      "Only database-backed definitions can be deleted from the UI. If a disk version exists, deleting the override makes the disk definition active again.",
  },
];

export default function HelpPage() {
  usePageTitle("TrackArr | Help");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Help</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            TrackArr uses plugin-defined tracker integrations to collect stats, compare them against configured thresholds,
            and expose both live dashboard cards and historical snapshot charts from the same integration data.
          </p>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Navigation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {navigationSections.map((section) => (
              <div key={section.title} className="space-y-1">
                <p className="text-sm font-medium text-foreground">{section.title}</p>
                <p className="text-sm text-muted-foreground">{section.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Working With Integrations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="space-y-1">
                <p className="font-medium text-foreground">1. Add a tracker</p>
                <p>
                  Use <span className="font-medium text-foreground">Add Tracker</span> on the dashboard, search the catalog,
                  and choose the plugin definition you want to connect.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">2. Enter plugin fields</p>
                <p>
                  Complete the required fields shown by that plugin. The form can include usernames, cookies, URLs,
                  credentials, ratios, or sync schedules depending on the tracker.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">3. Monitor the dashboard card</p>
                <p>
                  Each card shows plugin-backed metrics, ratio state, sync status, last sync time, next automatic sync,
                  and quick actions for syncing, editing, opening snapshots, or deleting the integration.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">4. Review history in snapshots</p>
                <p>
                  Open the snapshots view from the sidebar or directly from a tracker card to inspect uploaded,
                  downloaded, seeding, leeching, and active-torrent trends for a selected time window.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Dashboard Guidance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                The overview tiles summarize total uploaded, total downloaded, average ratio, and active torrent count
                across every configured integration.
              </p>
              <p>
                Tracker cards are rendered from plugin configuration, so metrics can evolve as plugin YAML changes while
                the shared card shell still handles status badges, warnings, sync actions, and snapshot links.
              </p>
              <p>
                When the current ratio falls below the configured required ratio, the card is highlighted to make the
                risk easier to spot.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Integration Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {integrationNotes.map((note) => (
                <div key={note.name} className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{note.name}</p>
                  <p className="text-sm text-muted-foreground">{note.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Plugin Definition Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pluginNotes.map((note) => (
                <div key={note.name} className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{note.name}</p>
                  <p className="text-sm text-muted-foreground">{note.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Good Practices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Verify plugin field labels before saving an integration, especially when the plugin requests schedules, ratios, or sensitive credentials.</p>
            <p>Use snapshots to confirm whether changes in uploaded, downloaded, or torrent counts are consistent over time after a sync.</p>
            <p>Edit plugin YAML carefully. A save updates the active definition immediately, which can change integration forms and dashboard rendering.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
