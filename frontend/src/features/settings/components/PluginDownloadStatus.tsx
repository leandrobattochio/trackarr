import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ApiPluginDownloadOutcome,
  ApiPluginDownloadPluginResult,
  ApiPluginDownloadStatus,
} from "@/features/settings/types";
import { formatDateTime } from "@/shared/lib/formatters";
import { cn } from "@/shared/lib/utils";

interface PluginDownloadStatusProps {
  isLoading: boolean;
  error: Error | null;
  status: ApiPluginDownloadStatus | null;
}

const SUCCESS = "border-success/40 bg-success/10 text-success";
const WARNING = "border-warning/40 bg-warning/10 text-warning";
const DANGER = "border-destructive/40 bg-destructive/10 text-destructive";
const MUTED = "border-border bg-muted/40 text-muted-foreground";

const OUTCOMES: Record<ApiPluginDownloadOutcome, { label: string; className: string }> = {
  installed: { label: "Installed", className: SUCCESS },
  updated: { label: "Updated", className: SUCCESS },
  unchanged: { label: "Unchanged", className: MUTED },
  failed: { label: "Failed", className: DANGER },
  incompatible: { label: "Incompatible", className: WARNING },
  locallyModified: { label: "Locally modified", className: WARNING },
  orphan: { label: "Orphan", className: WARNING },
  deprecated: { label: "Deprecated", className: WARNING },
  removed: { label: "Removed", className: MUTED },
};

function getPluginNotes(plugin: ApiPluginDownloadPluginResult) {
  return [
    plugin.message,
    plugin.overridden ? "You have an override of this plugin." : null,
    plugin.outdated ? "Your override is based on an older version." : null,
    plugin.hiddenByCustom ? "A custom plugin with the same id is used instead." : null,
  ].filter((note): note is string => Boolean(note));
}

export function PluginDownloadStatus({ isLoading, error, status }: PluginDownloadStatusProps) {
  const report = status?.lastDownload ?? null;
  const lastSuccessful = status?.lastSuccessfulIndex ?? null;

  return (
    <Card className="border-border/50" data-testid="plugin-download-status">
      <CardHeader>
        <CardTitle className="text-lg">Plugin Download</CardTitle>
        <CardDescription>
          Official plugins are downloaded from the plugin source when trackarr starts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading && (
          <div className="flex min-h-[120px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load the plugin download status: {error.message}
          </div>
        )}

        {!isLoading && !error && status && !report && (
          <p data-testid="plugin-download-none" className="text-sm text-muted-foreground">
            No plugin download has run yet.
          </p>
        )}

        {!isLoading && !error && report && (
          <>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-5">
              <dl className="grid gap-x-6 gap-y-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <dt className="text-sm font-semibold text-foreground">Result</dt>
                <dd>
                  <Badge variant="outline" data-testid="plugin-download-result" className={report.succeeded ? SUCCESS : DANGER}>
                    {report.succeeded ? "Succeeded" : "Failed"}
                  </Badge>
                </dd>
                <dt className="text-sm font-semibold text-foreground">Last Download</dt>
                <dd className="text-sm text-muted-foreground">
                  <time data-testid="plugin-download-time" dateTime={report.completedAt}>
                    {formatDateTime(report.completedAt)}
                  </time>
                </dd>
                <dt className="text-sm font-semibold text-foreground">Source</dt>
                <dd data-testid="plugin-download-source" className="text-sm text-muted-foreground break-all">
                  {report.source}
                </dd>
                <dt className="text-sm font-semibold text-foreground">Index Hash</dt>
                <dd data-testid="plugin-download-index" className="font-mono text-xs text-muted-foreground break-all">
                  {report.indexSha256 ?? "Not available"}
                </dd>
              </dl>
            </div>

            {report.error && (
              <div
                data-testid="plugin-download-error"
                className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
              >
                <p className="font-medium">The download failed: {report.error}</p>
                <p data-testid="plugin-download-fallback">
                  {lastSuccessful
                    ? `Plugins from the last successful download (${formatDateTime(lastSuccessful.fetchedAt)}) are still in use.`
                    : "No download has succeeded yet; the plugins already installed are kept."}
                </p>
              </div>
            )}

            {(report.plugins.length > 0 || (report.bases?.length ?? 0) > 0) && (
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Plugin</th>
                      <th className="px-4 py-2 font-medium">Version</th>
                      <th className="px-4 py-2 font-medium">Outcome</th>
                      <th className="px-4 py-2 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.bases ?? []).map((pluginBase) => {
                      const outcome = OUTCOMES[pluginBase.outcome] ?? { label: pluginBase.outcome, className: MUTED };
                      return (
                        <tr
                          key={`base-${pluginBase.baseId}`}
                          data-testid={`plugin-download-base-row-${pluginBase.baseId}`}
                          className="border-t border-border/60 align-top"
                        >
                          <td className="px-4 py-2 font-medium">{pluginBase.baseId} (base)</td>
                          <td className="px-4 py-2 text-muted-foreground">{pluginBase.version ?? "-"}</td>
                          <td className="px-4 py-2">
                            <Badge variant="outline" className={cn("whitespace-nowrap", outcome.className)}>
                              {outcome.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground break-all">{pluginBase.message}</td>
                        </tr>
                      );
                    })}
                    {report.plugins.map((plugin) => {
                      const outcome = OUTCOMES[plugin.outcome] ?? { label: plugin.outcome, className: MUTED };
                      return (
                        <tr
                          key={plugin.pluginId}
                          data-testid={`plugin-download-row-${plugin.pluginId}`}
                          className="border-t border-border/60 align-top"
                        >
                          <td className="px-4 py-2 font-medium">{plugin.pluginId}</td>
                          <td className="px-4 py-2 text-muted-foreground">{plugin.version ?? "-"}</td>
                          <td className="px-4 py-2">
                            <Badge
                              variant="outline"
                              data-testid={`plugin-download-outcome-${plugin.pluginId}`}
                              className={cn("whitespace-nowrap", outcome.className)}
                            >
                              {outcome.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground break-all">
                            {getPluginNotes(plugin).map((note) => (
                              <p key={note}>{note}</p>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
