import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SnapshotFiltersCard, SnapshotLineChartCard, SnapshotSummaryCards } from "@/features/snapshots/components";
import { useIntegrations, usePlugins } from "@/features/integrations/hooks";
import { mapIntegration } from "@/features/integrations/types";
import { useSnapshots } from "@/features/snapshots/hooks";
import { defaultSnapshotRange, formatSnapshotRangeLabel, isSnapshotRangeKey, type SnapshotRangeKey } from "@/features/snapshots/range";
import type { SnapshotFilters } from "@/features/snapshots/types";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePageTitle } from "@/shared/hooks/use-page-title";
import { formatBytes } from "@/shared/lib/formatters";

const DISPLAY_TIMEZONE = import.meta.env.VITE_APP_TIMEZONE || "America/Sao_Paulo";

const chartConfig = {
  uploadedBytes: {
    label: "Uploaded",
    color: "hsl(var(--success))",
  },
  downloadedBytes: {
    label: "Downloaded",
    color: "hsl(var(--primary))",
  },
  seedingTorrents: {
    label: "Seeding",
    color: "hsl(174 72% 46%)",
  },
  leechingTorrents: {
    label: "Leeching",
    color: "hsl(38 92% 50%)",
  },
  activeTorrents: {
    label: "Active",
    color: "hsl(0 72% 58%)",
  },
};

const transferSeriesOptions = [
  { key: "uploadedBytes", label: "Uploaded", strokeToken: "var(--color-uploadedBytes)", strokeWidth: 2.5 },
  { key: "downloadedBytes", label: "Downloaded", strokeToken: "var(--color-downloadedBytes)", strokeWidth: 2.5 },
] as const;

const torrentSeriesOptions = [
  { key: "seedingTorrents", label: "Seeding", strokeToken: "var(--color-seedingTorrents)" },
  { key: "leechingTorrents", label: "Leeching", strokeToken: "var(--color-leechingTorrents)" },
  { key: "activeTorrents", label: "Active", strokeToken: "var(--color-activeTorrents)" },
] as const;

type TransferSeriesKey = (typeof transferSeriesOptions)[number]["key"];
type TorrentSeriesKey = (typeof torrentSeriesOptions)[number]["key"];

function toLocalDateTimeInputValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function toUtcIsoFromLocalInput(value: string) {
  return new Date(value).toISOString();
}

function getDefaultCustomRange() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  return {
    from: toLocalDateTimeInputValue(oneHourAgo),
    to: toLocalDateTimeInputValue(now),
  };
}

function formatAxisTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DISPLAY_TIMEZONE,
  }).format(new Date(iso));
}

function formatExactDateTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: DISPLAY_TIMEZONE,
    timeZoneName: "short",
  }).format(new Date(iso));
}

export default function SnapshotsPage() {
  usePageTitle("TrackArr | Snapshots");

  const [searchParams, setSearchParams] = useSearchParams();
  const initialCustomRange = useMemo(() => getDefaultCustomRange(), []);
  const initialIntegrationId = searchParams.get("integrationId") ?? "";
  const initialRangeParam = searchParams.get("range");
  const initialRange: SnapshotRangeKey = isSnapshotRangeKey(initialRangeParam)
    ? initialRangeParam
    : defaultSnapshotRange;
  const initialFrom = searchParams.get("from") ?? initialCustomRange.from;
  const initialTo = searchParams.get("to") ?? initialCustomRange.to;

  const [integrationId, setIntegrationId] = useState(initialIntegrationId);
  const [range, setRange] = useState<SnapshotRangeKey>(initialRange);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [submittedFilters, setSubmittedFilters] = useState<SnapshotFilters>({
    integrationId: initialIntegrationId,
    range: initialRange,
    from: initialRange === "custom" ? initialFrom : undefined,
    to: initialRange === "custom" ? initialTo : undefined,
  });
  const [activeFilterAction, setActiveFilterAction] = useState<"apply" | "reset" | null>(null);
  const [isFilterTransitionPending, startFilterTransition] = useTransition();
  const [visibleTransferSeries, setVisibleTransferSeries] = useState<Record<TransferSeriesKey, boolean>>({
    uploadedBytes: true,
    downloadedBytes: true,
  });
  const [visibleTorrentSeries, setVisibleTorrentSeries] = useState<Record<TorrentSeriesKey, boolean>>({
    seedingTorrents: true,
    leechingTorrents: true,
    activeTorrents: true,
  });

  const { data: rawIntegrations = [], isLoading: integrationsLoading } = useIntegrations();
  const { data: plugins = [], isLoading: pluginsLoading } = usePlugins();

  const integrations = useMemo(
    () => rawIntegrations.map((integration) => mapIntegration(integration, plugins)),
    [rawIntegrations, plugins],
  );

  const activeIntegration = integrations.find((integration) => integration.id === submittedFilters.integrationId) ?? null;
  const byteUnitSystem = activeIntegration?.byteUnitSystem ?? "binary";

  const snapshotsQuery = useSnapshots(
    {
      integrationId: submittedFilters.integrationId,
      range: submittedFilters.range,
      from: submittedFilters.range === "custom" && submittedFilters.from
        ? toUtcIsoFromLocalInput(submittedFilters.from)
        : undefined,
      to: submittedFilters.range === "custom" && submittedFilters.to
        ? toUtcIsoFromLocalInput(submittedFilters.to)
        : undefined,
    },
    Boolean(submittedFilters.integrationId),
  );

  useEffect(() => {
    if (!snapshotsQuery.isFetching)
      setActiveFilterAction(null);
  }, [snapshotsQuery.isFetching]);

  useEffect(() => {
    if (!initialIntegrationId)
      return;

    setSearchParams({
      integrationId: initialIntegrationId,
      range: initialRange,
      ...(initialRange === "custom" ? { from: initialFrom, to: initialTo } : {}),
    }, { replace: true });
  }, [initialFrom, initialIntegrationId, initialRange, initialTo, setSearchParams]);

  const deferredSnapshotItems = useDeferredValue(snapshotsQuery.data?.items ?? []);

  const chartData = useMemo(
    () =>
      deferredSnapshotItems.map((item) => ({
        ...item,
        uploadedBytes: item.uploadedBytes ?? 0,
        downloadedBytes: item.downloadedBytes ?? 0,
        seedingTorrents: item.seedingTorrents ?? 0,
        leechingTorrents: item.leechingTorrents ?? 0,
        activeTorrents: item.activeTorrents ?? 0,
        label: formatAxisTime(item.capturedAt),
      })),
    [deferredSnapshotItems],
  );

  function toggleTransferSeries(key: TransferSeriesKey, checked: boolean) {
    setVisibleTransferSeries((current) => ({
      ...current,
      [key]: checked,
    }));
  }

  function toggleTorrentSeries(key: TorrentSeriesKey, checked: boolean) {
    setVisibleTorrentSeries((current) => ({
      ...current,
      [key]: checked,
    }));
  }

  function handleApplyFilters() {
    if (!integrationId)
      return;

    startFilterTransition(() => {
      setActiveFilterAction("apply");

      const nextFilters: SnapshotFilters = {
        integrationId,
        range,
        from: range === "custom" ? from : undefined,
        to: range === "custom" ? to : undefined,
      };

      setSubmittedFilters(nextFilters);
      setSearchParams({
        integrationId,
        range,
        ...(range === "custom" ? { from, to } : {}),
      });
    });
  }

  function handleResetFilters() {
    const defaultCustomRange = getDefaultCustomRange();

    if (!integrationId) {
      setRange(defaultSnapshotRange);
      setFrom(defaultCustomRange.from);
      setTo(defaultCustomRange.to);
      return;
    }

    startFilterTransition(() => {
      setActiveFilterAction("reset");
      setRange(defaultSnapshotRange);
      setFrom(defaultCustomRange.from);
      setTo(defaultCustomRange.to);
      setSubmittedFilters({
        integrationId,
        range: defaultSnapshotRange,
      });
      setSearchParams({
        integrationId,
        range: defaultSnapshotRange,
      });
    });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Snapshots</h1>
            <p className="text-sm text-muted-foreground">
              Review uploaded and downloaded values over time for a selected integration.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <SnapshotFiltersCard
          integrationId={integrationId}
          range={range}
          from={from}
          to={to}
          integrations={integrations}
          integrationsLoading={integrationsLoading}
          pluginsLoading={pluginsLoading}
          isBusy={snapshotsQuery.isFetching || isFilterTransitionPending}
          activeFilterAction={activeFilterAction}
          onIntegrationChange={setIntegrationId}
          onRangeChange={setRange}
          onFromChange={setFrom}
          onToChange={setTo}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        />

        <Card className="border-border/50">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>
                {activeIntegration ? `${activeIntegration.name} snapshots` : "Snapshots"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {submittedFilters.integrationId
                  ? formatSnapshotRangeLabel(submittedFilters.range, submittedFilters.from, submittedFilters.to)
                  : "Select an integration to load snapshot data."}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!submittedFilters.integrationId && (
              <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
                Choose an integration and apply a time range to view snapshots.
              </div>
            )}

            {submittedFilters.integrationId && snapshotsQuery.isLoading && (
              <div className="flex min-h-[320px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {submittedFilters.integrationId && snapshotsQuery.error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                Failed to load snapshots: {snapshotsQuery.error.message}
              </div>
            )}

            {submittedFilters.integrationId && !snapshotsQuery.isLoading && !snapshotsQuery.error && chartData.length === 0 && (
              <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
                No snapshot data was found for this integration in the selected time range.
              </div>
            )}

            {chartData.length > 0 && (
              <>
                <SnapshotSummaryCards
                  count={chartData.length}
                  firstSnapshotLabel={formatExactDateTime(chartData[0].capturedAt)}
                  latestSnapshotLabel={formatExactDateTime(chartData[chartData.length - 1].capturedAt)}
                />

                <div className="grid gap-6 xl:grid-cols-2">
                  <SnapshotLineChartCard
                    title="Transfer History"
                    description="Uploaded and downloaded values over time."
                    chartData={chartData}
                    chartConfig={chartConfig}
                    seriesOptions={transferSeriesOptions}
                    visibleSeries={visibleTransferSeries}
                    onToggleSeries={toggleTransferSeries}
                    yAxisWidth={88}
                    yAxisFormatter={(value) => formatBytes(value, byteUnitSystem)}
                    tooltipLabelFormatter={formatExactDateTime}
                    tooltipValueFormatter={(value, name) => ({
                      label: name === "uploadedBytes" ? "Uploaded" : "Downloaded",
                      value: formatBytes(value, byteUnitSystem),
                    })}
                  />

                  <SnapshotLineChartCard
                    title="Torrent Activity"
                    description="Seeding, leeching, and active torrent counts over time."
                    chartData={chartData}
                    chartConfig={chartConfig}
                    seriesOptions={torrentSeriesOptions}
                    visibleSeries={visibleTorrentSeries}
                    onToggleSeries={toggleTorrentSeries}
                    yAxisWidth={48}
                    yAxisFormatter={(value) => Number(value).toString()}
                    tooltipLabelFormatter={formatExactDateTime}
                    tooltipValueFormatter={(value, name) => ({
                      label: name === "seedingTorrents"
                        ? "Seeding"
                        : name === "leechingTorrents"
                          ? "Leeching"
                          : "Active",
                      value: Number(value).toString(),
                    })}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
