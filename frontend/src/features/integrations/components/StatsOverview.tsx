import { ArrowUpFromLine, ArrowDownToLine, Gauge, Server } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MetricTooltip } from "@/features/integrations/components/shared/MetricTooltip";
import { formatBytes, type ByteUnitSystem } from "@/shared/lib/formatters";
import { useAnimatedNumber } from "@/shared/hooks/use-animated-number";
import type { TrackerIntegration } from "@/features/integrations/types";

interface StatsOverviewProps {
  integrations: TrackerIntegration[];
}

function AnimatedBytesStat({ value, unitSystem }: { value: number; unitSystem: ByteUnitSystem }) {
  const animatedValue = useAnimatedNumber(value, {
    duration: 1200,
    decimals: 0,
    easing: "easeOutCubic",
  });

  return <>{formatBytes(animatedValue, unitSystem)}</>;
}

function AnimatedRatioStat({ value }: { value: number }) {
  const animatedValue = useAnimatedNumber(value, {
    duration: 1200,
    decimals: 2,
    easing: "easeOutCubic",
  });

  return <>{animatedValue.toFixed(2)}</>;
}

function AnimatedCountStat({ value }: { value: number }) {
  const animatedValue = useAnimatedNumber(value, {
    duration: 1100,
    decimals: 0,
    easing: "easeOutCubic",
  });

  return <>{Math.round(animatedValue).toString()}</>;
}

export function StatsOverview({ integrations }: StatsOverviewProps) {
  const totalUp = integrations.reduce((s, t) => s + (t.uploaded ?? 0), 0);
  const totalDown = integrations.reduce((s, t) => s + (t.downloaded ?? 0), 0);
  const avgRatio = totalDown > 0 ? totalUp / totalDown : 0;
  const totalActive = integrations.reduce((s, t) => s + (t.activeTorrents ?? 0), 0);
  const byteUnitSystem = resolveOverviewByteUnitSystem(integrations);

  const stats = [
    {
      label: "Total Uploaded",
      value: <AnimatedBytesStat value={totalUp} unitSystem={byteUnitSystem} />,
      icon: ArrowUpFromLine,
      color: "text-success",
      tooltip: {
        eyebrow: "Portfolio Transfer",
        description: "Combined uploaded data across every connected tracker.",
      },
    },
    {
      label: "Total Downloaded",
      value: <AnimatedBytesStat value={totalDown} unitSystem={byteUnitSystem} />,
      icon: ArrowDownToLine,
      color: "text-primary",
      tooltip: {
        eyebrow: "Portfolio Transfer",
        description: "Combined downloaded data across every connected tracker.",
      },
    },
    {
      label: "Avg Ratio",
      value: <AnimatedRatioStat value={avgRatio} />,
      icon: Gauge,
      color: avgRatio >= 1 ? "text-success" : "text-warning",
      tooltip: {
        eyebrow: "Health Signal",
        description: "Overall ratio computed from total uploaded divided by total downloaded.",
      },
    },
    {
      label: "Active Torrents",
      value: <AnimatedCountStat value={totalActive} />,
      icon: Server,
      color: "text-muted-foreground",
      tooltip: {
        eyebrow: "Live Workload",
        description: "Current active torrent count summed across all integrations.",
      },
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/50">
          <CardContent className="flex items-center gap-4 p-4">
            <MetricTooltip
              label={stat.label}
              eyebrow={stat.tooltip.eyebrow}
              description={stat.tooltip.description}
            >
              <button
                type="button"
                className="group inline-flex rounded-lg border border-transparent bg-muted p-2.5 transition-all duration-200 hover:border-border/80 hover:bg-muted/80 hover:shadow-[0_0_0_1px_hsl(var(--border)/0.35),0_10px_30px_hsl(var(--background)/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={stat.label}
              >
                <stat.icon className={`h-5 w-5 transition-transform duration-200 group-hover:-translate-y-0.5 ${stat.color}`} aria-hidden="true" />
                <span className="sr-only">{stat.label}</span>
              </button>
            </MetricTooltip>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="font-display text-xl font-bold">{stat.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function resolveOverviewByteUnitSystem(integrations: TrackerIntegration[]): ByteUnitSystem {
  if (integrations.length === 0) return "binary";

  const first = integrations[0].byteUnitSystem;
  return integrations.every((integration) => integration.byteUnitSystem === first)
    ? first
    : "binary";
}
