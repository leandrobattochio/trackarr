import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface SnapshotChartSeries<TSeriesKey extends string> {
  key: TSeriesKey;
  label: string;
  strokeToken: string;
  strokeWidth?: number;
}

interface SnapshotLineChartCardProps<TChartData extends Record<string, unknown>, TSeriesKey extends string> {
  title: string;
  description: string;
  chartData: TChartData[];
  chartConfig: Record<string, { label: string; color: string }>;
  seriesOptions: readonly SnapshotChartSeries<TSeriesKey>[];
  visibleSeries: Record<TSeriesKey, boolean>;
  onToggleSeries: (key: TSeriesKey, checked: boolean) => void;
  yAxisWidth: number;
  yAxisFormatter: (value: number) => string;
  tooltipValueFormatter: (value: number, name: TSeriesKey) => { label: string; value: string };
  tooltipLabelFormatter: (iso: string) => string;
}

export function SnapshotLineChartCard<TChartData extends Record<string, unknown>, TSeriesKey extends string>({
  title,
  description,
  chartData,
  chartConfig,
  seriesOptions,
  visibleSeries,
  onToggleSeries,
  yAxisWidth,
  yAxisFormatter,
  tooltipValueFormatter,
  tooltipLabelFormatter,
}: SnapshotLineChartCardProps<TChartData, TSeriesKey>) {
  return (
    <Card className="border-border/50 bg-muted/10">
      <CardHeader className="space-y-4">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {seriesOptions.map((series) => (
            <label
              key={series.key}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm"
            >
              <Checkbox
                checked={visibleSeries[series.key]}
                onCheckedChange={(checked) => onToggleSeries(series.key, checked === true)}
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
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => yAxisFormatter(Number(value))}
              width={yAxisWidth}
            />
            <ChartTooltip
              content={(
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.capturedAt
                      ? tooltipLabelFormatter(String(payload[0].payload.capturedAt))
                      : ""
                  }
                  formatter={(value, name) => {
                    const formatted = tooltipValueFormatter(Number(value), name as TSeriesKey);

                    return (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">{formatted.label}</span>
                        <span className="font-mono font-medium text-foreground">{formatted.value}</span>
                      </div>
                    );
                  }}
                />
              )}
            />
            <ChartLegend content={<ChartLegendContent />} />
            {seriesOptions.map((series) =>
              visibleSeries[series.key] ? (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  stroke={series.strokeToken}
                  strokeWidth={series.strokeWidth ?? 2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ) : null,
            )}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
