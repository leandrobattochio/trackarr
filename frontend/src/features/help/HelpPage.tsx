import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePageTitle } from "@/shared/hooks/use-page-title";

const fields = [
  { name: "Required Fields", detail: "Each integration has required fields. You need to fill every required field before the integration can be saved." },
  { name: "Different Integrations", detail: "Different integrations may ask for different values. Some may require a URL, credentials, cookies, usernames, ratio targets, or scheduling information." },
  { name: "Cron Expression", detail: "If an integration asks for a cron expression, use the schedule format shown in the form help text and enter it carefully." },
  { name: "Required Ratio", detail: "If an integration asks for a required ratio, this is the minimum ratio target TrackArr will use for dashboard comparisons." },
];

export default function HelpPage() {
  usePageTitle("TrackArr | Help");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Help</h1>
          <p className="text-sm text-muted-foreground">
            TrackArr lets you register private tracker integrations, sync them manually or automatically,
            and monitor whether each tracker is above or below your configured minimum ratio.
          </p>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>How To Use TrackArr</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-1">
              <p className="font-medium text-foreground">1. Add a tracker</p>
              <p>
                Use <span className="font-medium text-foreground">Add Tracker</span> on the dashboard and choose an integration.
                The application will show the fields required for that integration.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">2. Fill the required fields</p>
              <p>
                Fill each field carefully and make sure values match what your tracker expects.
                Different integrations can have different field sets, so do not assume every tracker uses the same inputs.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">3. Save the integration</p>
              <p>
                After saving, the integration will appear on the dashboard and TrackArr will use the values you provided for future syncs.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">4. Sync manually or wait for the schedule</p>
              <p>
                Use the <span className="font-medium text-foreground">Sync</span> button when you want to refresh data immediately.
                If the integration includes scheduling, TrackArr can also refresh it automatically.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">5. Read the dashboard</p>
              <p>
                Each card shows the current ratio, the configured minimum ratio, uploaded and downloaded totals, seeding,
                leeching, active torrents, and sync timing details when available.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Integration Fields</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field) => (
                <div key={field.name} className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{field.name}</p>
                  <p className="text-sm text-muted-foreground">{field.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Dashboard Guidance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                The ratio section compares your current ratio to the minimum ratio configured for that integration.
                If your current ratio is below the required value, the card is highlighted to make that risk more obvious.
              </p>
              <p>
                Uploaded, downloaded, active, seeding, and leeching values help you understand the current state of each integration at a glance.
              </p>
              <p>
                Last sync and next automatic sync are shown on the card when that information is available.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Good Practices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Review field labels and help text before saving, especially for scheduling and ratio-related values.</p>
            <p>If a sync fails, verify the values you entered for that integration before trying again.</p>
            <p>When editing an integration, keep its values up to date so dashboard data stays accurate.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
