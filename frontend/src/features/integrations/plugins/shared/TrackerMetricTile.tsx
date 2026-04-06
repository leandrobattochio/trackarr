import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { MetricTooltip } from "@/features/integrations/components/shared/MetricTooltip";
import { useAnimatedNumber } from "@/shared/hooks/use-animated-number";
import { formatBytes, type ByteUnitSystem } from "@/shared/lib/formatters";

interface TrackerMetricTileProps {
  label: string;
  icon: LucideIcon;
  iconClassName: string;
  value: ReactNode;
}

export function TrackerMetricTile({ label, icon: Icon, iconClassName, value }: TrackerMetricTileProps) {
  const tooltipCopy = getMetricTooltipCopy(label);

  return (
    <div
      className="min-w-0 overflow-hidden rounded-md bg-muted/50 p-3"
      aria-label={label}
    >
      <div className="flex items-center justify-center">
        <MetricTooltip
          label={label}
          eyebrow={tooltipCopy.eyebrow}
          description={tooltipCopy.description}
        >
          <button
            type="button"
            className="group inline-flex cursor-default rounded-full border border-transparent p-1.5 transition-all duration-200 hover:border-border/80 hover:bg-background/70 hover:shadow-[0_0_0_1px_hsl(var(--border)/0.35),0_10px_30px_hsl(var(--background)/0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={label}
          >
            <Icon className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 ${iconClassName}`} aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </button>
        </MetricTooltip>
      </div>
      <p className="mt-2 truncate text-center font-display text-sm font-semibold">{value}</p>
    </div>
  );
}

function getMetricTooltipCopy(label: string) {
  switch (label) {
    case "Uploaded":
      return {
        eyebrow: "Transfer",
        description: "Total data sent back to the tracker.",
      };
    case "Downloaded":
      return {
        eyebrow: "Transfer",
        description: "Total data pulled down from the tracker.",
      };
    case "Seed Bonus":
      return {
        eyebrow: "Reward",
        description: "Bonus points earned from sustained seeding activity.",
      };
    case "Buffer":
      return {
        eyebrow: "Capacity",
        description: "Extra downloadable room available before ratio pressure builds.",
      };
    case "Hit & Runs":
      return {
        eyebrow: "Compliance",
        description: "Torrents that still require more seeding time to clear.",
      };
    default:
      return {
        eyebrow: "Tracker Metric",
        description: `Current ${label.toLowerCase()} value for this integration.`,
      };
  }
}

function AnimatedBytesValue({ value, unitSystem }: { value: number | null; unitSystem: ByteUnitSystem }) {
  const animatedValue = useAnimatedNumber(value ?? 0, {
    duration: 1200,
    decimals: 0,
    easing: "easeOutCubic",
  });

  if (value === null) {
    return <span>--</span>;
  }

  return <span>{formatBytes(animatedValue, unitSystem)}</span>;
}

function AnimatedLongValue({ value }: { value: number | null }) {
  const animatedValue = useAnimatedNumber(value ?? 0, {
    duration: 1200,
    decimals: 0,
    easing: "easeOutCubic",
  });

  if (value === null) {
    return <span>--</span>;
  }

  return <span>{Math.round(animatedValue).toLocaleString()}</span>;
}

function StaticMetricValue({ value }: { value: string | null }) {
  if (!value) {
    return <span>--</span>;
  }

  return <span>{value}</span>;
}

interface BytesMetricTileProps {
  label: string;
  icon: LucideIcon;
  iconClassName: string;
  value: number | null;
  unitSystem: ByteUnitSystem;
}

export function BytesMetricTile({ label, icon, iconClassName, value, unitSystem }: BytesMetricTileProps) {
  return (
    <TrackerMetricTile
      label={label}
      icon={icon}
      iconClassName={iconClassName}
      value={<AnimatedBytesValue value={value} unitSystem={unitSystem} />}
    />
  );
}

interface CountMetricTileProps {
  label: string;
  icon: LucideIcon;
  iconClassName: string;
  value: number | null;
}

export function CountMetricTile({ label, icon, iconClassName, value }: CountMetricTileProps) {
  return (
    <TrackerMetricTile
      label={label}
      icon={icon}
      iconClassName={iconClassName}
      value={<AnimatedLongValue value={value} />}
    />
  );
}

interface TextMetricTileProps {
  label: string;
  icon: LucideIcon;
  iconClassName: string;
  value: string | null;
}

export function TextMetricTile({ label, icon, iconClassName, value }: TextMetricTileProps) {
  return (
    <TrackerMetricTile
      label={label}
      icon={icon}
      iconClassName={iconClassName}
      value={<StaticMetricValue value={value} />}
    />
  );
}
