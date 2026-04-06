import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiAboutInfo } from "@/features/settings/types";

interface AboutTabProps {
  isLoading: boolean;
  error: Error | null;
  aboutInfo: ApiAboutInfo | null;
}

export function AboutTab({ isLoading, error, aboutInfo }: AboutTabProps) {
  const rows = aboutInfo
    ? [
        ["Version", aboutInfo.version],
        [".NET", aboutInfo.dotNetVersion],
        ["Docker", aboutInfo.runningInDocker ? "Yes" : "No"],
        ["Database", aboutInfo.databaseEngine],
        ["Applied Migrations", aboutInfo.appliedMigrations.toString()],
        ["AppData Directory", aboutInfo.appDataDirectory],
        ["Startup Directory", aboutInfo.startupDirectory],
        ["Environment", aboutInfo.environmentName],
        ["Uptime", aboutInfo.uptime],
      ]
    : [];

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">System Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading && (
          <div className="flex min-h-[220px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load system information: {error.message}
          </div>
        )}

        {!isLoading && !error && aboutInfo && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-5">
            <dl className="grid gap-x-6 gap-y-3 md:grid-cols-[220px_minmax(0,1fr)]">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-sm font-semibold text-foreground">{label}</dt>
                  <dd className="text-sm text-muted-foreground break-all">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
