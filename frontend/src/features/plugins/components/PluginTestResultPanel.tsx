import { isInfiniteRatio } from "@/features/integrations/ratio";
import type { ApiIntegrationStats, ApiSyncResult } from "@/features/integrations/types";
import type { ApiPluginTestResult } from "@/features/plugins/types";
import { formatBytes } from "@/shared/lib/formatters";
import { cn } from "@/shared/lib/utils";

const OUTCOMES: Record<ApiSyncResult, { label: string; className: string }> = {
  success: { label: "Success", className: "border-success/40 bg-success/10 text-success" },
  authFailed: { label: "Authentication failed", className: "border-destructive/40 bg-destructive/10 text-destructive" },
  unknownError: { label: "Failed", className: "border-destructive/40 bg-destructive/10 text-destructive" },
};

const STAT_LABELS: Record<keyof ApiIntegrationStats, string> = {
  ratio: "Ratio",
  uploadedBytes: "Uploaded",
  downloadedBytes: "Downloaded",
  seedBonus: "Seed bonus",
  buffer: "Buffer",
  hitAndRuns: "Hit and runs",
  requiredRatio: "Required ratio",
  seedingTorrents: "Seeding",
  leechingTorrents: "Leeching",
  activeTorrents: "Active",
};

function formatStat(key: keyof ApiIntegrationStats, value: string | number) {
  return (key === "uploadedBytes" || key === "downloadedBytes") && typeof value === "number"
    ? formatBytes(value)
    : String(value);
}

function isSuccessStatus(statusCode: number) {
  return statusCode >= 200 && statusCode < 300;
}

export function PluginTestResultPanel({ result }: { result: ApiPluginTestResult }) {
  const outcome = OUTCOMES[result.outcome];
  const error = result.error !== result.failedField?.error ? result.error : null;
  const infiniteRatio = result.stats !== null && isInfiniteRatio(result.stats.ratio, result.stats.downloadedBytes);
  const stats = (Object.keys(STAT_LABELS) as (keyof ApiIntegrationStats)[]).flatMap((key) => {
    const value = key === "ratio" && infiniteRatio ? "∞" : result.stats?.[key];
    return value === null || value === undefined ? [] : [{ key, value }];
  });

  return (
    <div data-testid="plugin-test-result" data-outcome={result.outcome} className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Outcome</span>
        <span data-testid="plugin-test-outcome" className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", outcome.className)}>
          {outcome.label}
        </span>
      </div>

      {error && (
        <p data-testid="plugin-test-error" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
          {error}
        </p>
      )}

      {result.failedField && (
        <div data-testid="plugin-test-failed-field" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="font-medium text-foreground">
            Failed field <code className="font-mono">{result.failedField.field}</code>
            {result.failedField.step ? (
              <>
                {" "}in step <code className="font-mono">{result.failedField.step}</code>
              </>
            ) : (
              " in the mapping"
            )}
          </p>
          <p className="text-destructive">{result.failedField.error}</p>
        </div>
      )}

      <section className="space-y-2">
        <h3 className="font-medium">Steps</h3>
        {result.steps.length === 0 ? (
          <p className="text-muted-foreground">No request was sent.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
            {result.steps.map((step, index) => (
              <li
                key={`${step.name}-${index}`}
                data-testid={`plugin-test-step-${step.name}`}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium">{step.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {step.method} {step.path}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-0.5 font-mono text-xs",
                    isSuccessStatus(step.statusCode) ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
                  )}
                >
                  HTTP {step.statusCode}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Extracted stats</h3>
        {stats.length === 0 ? (
          <p className="text-muted-foreground">No stats were extracted.</p>
        ) : (
          <dl data-testid="plugin-test-stats" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {stats.map(({ key, value }) => (
              <div key={key} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                <dt className="text-xs text-muted-foreground">{STAT_LABELS[key]}</dt>
                <dd className="font-medium">{formatStat(key, value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}
