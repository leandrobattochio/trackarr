import { ArrowDownToLine, ArrowUpFromLine, BarChart3, Coins, HardDrive, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TrackerIntegration, ApiDashboardMetric } from "@/features/integrations/types";
import { TrackerCardShell } from "@/features/integrations/plugins/shared/TrackerCardShell";
import { BytesMetricTile, CountMetricTile, TextMetricTile } from "@/features/integrations/plugins/shared/TrackerMetricTile";
import { RatioThresholdCard } from "@/features/integrations/plugins/shared/RatioThresholdCard";

interface ConfiguredTrackerCardProps {
  tracker: TrackerIntegration;
}

const ICONS: Record<string, LucideIcon> = {
  "arrow-up": ArrowUpFromLine,
  "arrow-down": ArrowDownToLine,
  coins: Coins,
  "hard-drive": HardDrive,
  "shield-alert": ShieldAlert,
};

const TONES: Record<string, string> = {
  success: "text-success",
  primary: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
};

export function ConfiguredTrackerCard({ tracker }: ConfiguredTrackerCardProps) {
  const metrics = tracker.dashboard.metrics;

  return (
    <TrackerCardShell
      tracker={tracker}
      ratio={<RatioThresholdCard ratio={tracker.ratio} requiredRatio={tracker.requiredRatio} />}
      metrics={(
        <div className={resolveGridClassName(metrics.length)}>
          {metrics.map((metric) => renderMetricTile(metric, tracker))}
        </div>
      )}
    />
  );
}

function renderMetricTile(metric: ApiDashboardMetric, tracker: TrackerIntegration) {
  const Icon = ICONS[metric.icon] ?? BarChart3;
  const iconClassName = TONES[metric.tone] ?? "text-primary";
  const key = `${tracker.id}-${metric.stat}-${metric.label}`;

  switch (metric.format) {
    case "bytes":
      return (
        <BytesMetricTile
          key={key}
          label={metric.label}
          icon={Icon}
          iconClassName={iconClassName}
          value={resolveNumberMetricValue(tracker, metric.stat)}
          unitSystem={tracker.byteUnitSystem}
        />
      );
    case "count":
      return (
        <CountMetricTile
          key={key}
          label={metric.label}
          icon={Icon}
          iconClassName={iconClassName}
          value={resolveNumberMetricValue(tracker, metric.stat)}
        />
      );
    default:
      return (
        <TextMetricTile
          key={key}
          label={metric.label}
          icon={Icon}
          iconClassName={iconClassName}
          value={resolveTextMetricValue(tracker, metric.stat)}
        />
      );
  }
}

function resolveGridClassName(metricCount: number) {
  if (metricCount <= 1) return "grid grid-cols-1 gap-3";
  if (metricCount === 2) return "grid grid-cols-2 gap-3";
  if (metricCount <= 3) return "grid grid-cols-3 gap-3";
  return "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";
}

function resolveNumberMetricValue(tracker: TrackerIntegration, stat: ApiDashboardMetric["stat"]) {
  switch (stat) {
    case "uploadedBytes":
      return tracker.uploaded;
    case "downloadedBytes":
      return tracker.downloaded;
    case "hitAndRuns":
      return tracker.hitAndRuns;
    case "seedingTorrents":
      return tracker.seedingTorrents;
    case "leechingTorrents":
      return tracker.leechingTorrents;
    case "activeTorrents":
      return tracker.activeTorrents;
    default:
      return null;
  }
}

function resolveTextMetricValue(tracker: TrackerIntegration, stat: ApiDashboardMetric["stat"]) {
  switch (stat) {
    case "seedBonus":
      return tracker.seedBonus;
    case "buffer":
      return tracker.buffer;
    case "ratio":
      return tracker.ratio === null ? null : tracker.ratio.toFixed(2);
    case "requiredRatio":
      return tracker.requiredRatio === null ? null : tracker.requiredRatio.toFixed(2);
    case "seedingTorrents":
      return tracker.seedingTorrents === null ? null : tracker.seedingTorrents.toLocaleString();
    case "leechingTorrents":
      return tracker.leechingTorrents === null ? null : tracker.leechingTorrents.toLocaleString();
    case "activeTorrents":
      return tracker.activeTorrents === null ? null : tracker.activeTorrents.toLocaleString();
    case "hitAndRuns":
      return tracker.hitAndRuns === null ? null : tracker.hitAndRuns.toLocaleString();
    default:
      return null;
  }
}
