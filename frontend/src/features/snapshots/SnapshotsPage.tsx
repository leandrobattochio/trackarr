import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ArrowLeft, ChartLine, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useIntegrations, usePlugins } from "@/features/integrations/hooks";
import { mapIntegration } from "@/features/integrations/types";
import { useSnapshots } from "@/features/snapshots/hooks";
import type { SnapshotFilters } from "@/features/snapshots/types";
import { usePageTitle } from "@/shared/hooks/use-page-title";
import { formatBytes } from "@/shared/lib/formatters";

const DISPLAY_TIMEZONE = import.meta.env.VITE_APP_TIMEZONE || "America/Sao_Paulo";

function toLocalDateTimeInputValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function toUtcIsoFromLocalInput(value: string) {
  return new Date(value).toISOString();
}

function getDefaultRange() {
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
  { key: "uploadedBytes", label: "Uploaded" },
  { key: "downloadedBytes", label: "Downloaded" },
 ] as const;

const torrentSeriesOptions = [
  { key: "seedingTorrents", label: "Seeding" },
  { key: "leechingTorrents", label: "Leeching" },
  { key: "activeTorrents", label: "Active" },
] as const;
type TransferSeriesKey = (typeof transferSeriesOptions)[number]["key"];
type TorrentSeriesKey = (typeof torrentSeriesOptions)[number]["key"];

export default function SnapshotsPage() {
  usePageTitle("TrackArr | Snapshots");

  const [searchParams, setSearchParams] = useSearchParams();
  const initialRange = useMemo(() => getDefaultRange(), []);

  const initialIntegrationId = searchParams.get("integrationId") ?? "";
  const initialFrom = searchParams.get("from") ?? initialRange.from;
  const initialTo = searchParams.get("to") ?? initialRange.to;

  const [integrationId, setIntegrationId] = useState(initialIntegrationId);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [submittedFilters, setSubmittedFilters] = useState<SnapshotFilters>({
    integrationId: initialIntegrationId,
    from: initialFrom,
    to: initialTo,
  });
  const [activeFilterAction, setActiveFilterAction] = useState<"apply" | "reset" | null>(null);
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

  const snapshotsQuery = useSnapshots(
    {
      integrationId: submittedFilters.integrationId,
      from: toUtcIsoFromLocalInput(submittedFilters.from),
      to: toUtcIsoFromLocalInput(submittedFilters.to),
    },
    Boolean(submittedFilters.integrationId),
  );

  useEffect(() => {
    if (!snapshotsQuery.isFetching) {
      setActiveFilterAction(null);
    }
  }, [snapshotsQuery.isFetching]);

  useEffect(() => {
    if (!initialIntegrationId) {
      return;
    }

    setSearchParams({
      integrationId: initialIntegrationId,
      from: initialFrom,
      to: initialTo,
    }, { replace: true });
  }, [initialFrom, initialIntegrationId, initialTo, setSearchParams]);

  const chartData = useMemo(
    () =>
      (snapshotsQuery.data?.items ?? []).map((item) => ({
        ...item,
        uploadedBytes: item.uploadedBytes ?? 0,
        downloadedBytes: item.downloadedBytes ?? 0,
        seedingTorrents: item.seedingTorrents ?? 0,
        leechingTorrents: item.leechingTorrents ?? 0,
        activeTorrents: item.activeTorrents ?? 0,
        label: formatAxisTime(item.capturedAt),
      })),
    [snapshotsQuery.data?.items],
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
    if (!integrationId) {
      return;
    }

    setActiveFilterAction("apply");
    setSubmittedFilters({
      integrationId,
      from,
      to,
    });

    setSearchParams({
      integrationId,
      from,
      to,
    });
  }

  function handleResetFilters() {
    const defaultRange = getDefaultRange();

    if (!integrationId) {
      setFrom(defaultRange.from);
      setTo(defaultRange.to);
      return;
    }

    setActiveFilterAction("reset");
    setFrom(defaultRange.from);
    setTo(defaultRange.to);

    setSubmittedFilters({
      integrationId,
      from: defaultRange.from,
      to: defaultRange.to,
    });

    setSearchParams({
      integrationId,
      from: defaultRange.from,
      to: defaultRange.to,
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

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
            <div className="space-y-1.5">
              <Label>Integration</Label>
              <Select value={integrationId} onValueChange={setIntegrationId} disabled={integrationsLoading || pluginsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an integration" />
                </SelectTrigger>
                <SelectContent>
                  {integrations.map((integration) => (
                    <SelectItem key={integration.id} value={integration.id}>
                      {integration.name}{integration.username ? ` · ${integration.username}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="snapshot-from">From</Label>
              <Input id="snapshot-from" type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="snapshot-to">To</Label>
              <Input id="snapshot-to" type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full lg:w-auto"
                onClick={handleApplyFilters}
                disabled={!integrationId || snapshotsQuery.isFetching}
              >
                {activeFilterAction === "apply" && snapshotsQuery.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply
              </Button>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                className="w-full lg:w-auto"
                onClick={handleResetFilters}
                disabled={snapshotsQuery.isFetching}
              >
                {activeFilterAction === "reset" && snapshotsQuery.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>
                {activeIntegration ? `${activeIntegration.name} snapshots` : "Snapshots"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {submittedFilters.integrationId
                  ? `${submittedFilters.from} to ${submittedFilters.to}`
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
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Points</p>
                    <p className="mt-1 font-display text-lg font-semibold">{chartData.length}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">First Snapshot</p>
                    <p className="mt-1 text-sm font-medium">{formatExactDateTime(chartData[0].capturedAt)}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Latest Snapshot</p>
                    <p className="mt-1 text-sm font-medium">{formatExactDateTime(chartData[chartData.length - 1].capturedAt)}</p>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <Card className="border-border/50 bg-muted/10">
                    <CardHeader className="space-y-4">
                      <div>
                        <CardTitle className="text-base">Transfer History</CardTitle>
                        <p className="text-sm text-muted-foreground">Uploaded and downloaded values over time.</p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {transferSeriesOptions.map((series) => (
                          <label
                            key={series.key}
                            className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                          >
                            <Checkbox
                              checked={visibleTransferSeries[series.key]}
                              onCheckedChange={(checked) => toggleTransferSeries(series.key, checked === true)}
                            />
                            <span>{series.label}</span>
                          </label>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={chartConfig} className="min-h-[320px] w-full">
                        <LineChart accessibilityLayer data={chartData} margin={{ left: 12, right: 12, top: 16 }}>
                          <CartesianGrid vertical={false} />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            minTickGap={24}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => formatBytes(value)}
                            width={88}
                          />
                          <ChartTooltip
                            content={(
                              <ChartTooltipContent
                                labelFormatter={(_, payload) =>
                                  payload?.[0]?.payload?.capturedAt
                                    ? formatExactDateTime(payload[0].payload.capturedAt)
                                    : ""
                                }
                                formatter={(value, name) => (
                                  <div className="flex w-full items-center justify-between gap-4">
                                    <span className="text-muted-foreground">
                                      {name === "uploadedBytes" ? "Uploaded" : "Downloaded"}
                                    </span>
                                    <span className="font-mono font-medium text-foreground">
                                      {formatBytes(Number(value))}
                                    </span>
                                  </div>
                                )}
                              />
                            )}
                          />
                          <ChartLegend content={<ChartLegendContent />} />
                          {visibleTransferSeries.uploadedBytes && (
                            <Line
                              type="monotone"
                              dataKey="uploadedBytes"
                              stroke="var(--color-uploadedBytes)"
                              strokeWidth={2.5}
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                          )}
                          {visibleTransferSeries.downloadedBytes && (
                            <Line
                              type="monotone"
                              dataKey="downloadedBytes"
                              stroke="var(--color-downloadedBytes)"
                              strokeWidth={2.5}
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                          )}
                        </LineChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 bg-muted/10">
                    <CardHeader className="space-y-4">
                      <div>
                        <CardTitle className="text-base">Torrent Activity</CardTitle>
                        <p className="text-sm text-muted-foreground">Seeding, leeching, and active torrent counts over time.</p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {torrentSeriesOptions.map((series) => (
                          <label
                            key={series.key}
                            className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                          >
                            <Checkbox
                              checked={visibleTorrentSeries[series.key]}
                              onCheckedChange={(checked) => toggleTorrentSeries(series.key, checked === true)}
                            />
                            <span>{series.label}</span>
                          </label>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={chartConfig} className="min-h-[320px] w-full">
                        <LineChart accessibilityLayer data={chartData} margin={{ left: 12, right: 12, top: 16 }}>
                          <CartesianGrid vertical={false} />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            minTickGap={24}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => Number(value).toString()}
                            width={48}
                          />
                          <ChartTooltip
                            content={(
                              <ChartTooltipContent
                                labelFormatter={(_, payload) =>
                                  payload?.[0]?.payload?.capturedAt
                                    ? formatExactDateTime(payload[0].payload.capturedAt)
                                    : ""
                                }
                                formatter={(value, name) => (
                                  <div className="flex w-full items-center justify-between gap-4">
                                    <span className="text-muted-foreground">
                                      {name === "seedingTorrents"
                                        ? "Seeding"
                                        : name === "leechingTorrents"
                                          ? "Leeching"
                                          : "Active"}
                                    </span>
                                    <span className="font-mono font-medium text-foreground">
                                      {Number(value).toString()}
                                    </span>
                                  </div>
                                )}
                              />
                            )}
                          />
                          <ChartLegend content={<ChartLegendContent />} />
                          {visibleTorrentSeries.seedingTorrents && (
                            <Line
                              type="monotone"
                              dataKey="seedingTorrents"
                              stroke="var(--color-seedingTorrents)"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                          )}
                          {visibleTorrentSeries.leechingTorrents && (
                            <Line
                              type="monotone"
                              dataKey="leechingTorrents"
                              stroke="var(--color-leechingTorrents)"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                          )}
                          {visibleTorrentSeries.activeTorrents && (
                            <Line
                              type="monotone"
                              dataKey="activeTorrents"
                              stroke="var(--color-activeTorrents)"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                          )}
                        </LineChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
