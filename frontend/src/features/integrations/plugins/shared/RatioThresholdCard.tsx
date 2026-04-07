import { useEffect, useState } from "react";
import { MetricTooltip } from "@/features/integrations/components/shared/MetricTooltip";
import { useAnimatedNumber } from "@/shared/hooks/use-animated-number";

function getRatioColor(ratio: number): string {
  if (ratio >= 2) return "text-success";
  if (ratio >= 1) return "text-primary";
  if (ratio >= 0.8) return "text-warning";
  return "text-destructive";
}

function formatRatioDelta(ratio: number | null, requiredRatio: number | null): string {
  if (ratio === null || requiredRatio === null) return "Set a required ratio to compare against";

  const delta = ratio - requiredRatio;
  if (delta >= 0) return `+${delta.toFixed(2)} above minimum`;
  return `${delta.toFixed(2)} below minimum`;
}

function buildThresholdGradient(thresholdPercent: number): string {
  const safeThreshold = Math.max(0, Math.min(thresholdPercent, 100));
  const warmStop = Math.max(0, safeThreshold - 12);

  return `linear-gradient(90deg,
    rgb(239 68 68) 0%,
    rgb(239 68 68) ${Math.max(0, warmStop * 0.45)}%,
    rgb(245 158 11) ${warmStop}%,
    rgb(34 197 94) ${safeThreshold}%,
    rgb(34 197 94) 100%)`;
}

interface RatioThresholdCardProps {
  ratio: number | null;
  requiredRatio: number | null;
}

export function RatioThresholdCard({ ratio, requiredRatio }: RatioThresholdCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const currentRatio = ratio ?? 0;
  const minimumRatio = requiredRatio ?? 1;
  const displayMax = Math.max(minimumRatio * 2, currentRatio, 2);
  const fillPercent = Math.min((currentRatio / displayMax) * 100, 100);
  const thresholdPercent = Math.min((minimumRatio / displayMax) * 100, 100);
  const thresholdGradient = buildThresholdGradient(thresholdPercent);
  const animatedRatio = useAnimatedNumber(ratio ?? 0, { duration: 1200, decimals: 2, easing: "easeOutCubic" });
  const animatedFillPercent = useAnimatedNumber(fillPercent, { duration: 950, decimals: 2, easing: "linear" });

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={`rounded-lg border border-border/50 bg-muted/30 p-4 transition-all duration-700 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Ratio</span>
        <span className="text-xs text-muted-foreground">Minimum {minimumRatio.toFixed(2)}</span>
      </div>
      <div className="space-y-4">
        <div className="text-center">
          <div className="flex justify-center">
            <MetricTooltip
              label="Current Ratio"
              eyebrow="Health Signal"
              description="This tracker's upload-to-download ratio, showing how much data you have sent back relative to what you downloaded."
            >
              <button
                type="button"
                className={`inline-flex cursor-default rounded-full border border-transparent px-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${ratio !== null ? getRatioColor(ratio) : "text-muted-foreground"}`}
                aria-label="Current ratio details"
              >
                <span className="font-display text-4xl font-bold">
                  {ratio !== null ? animatedRatio.toFixed(2) : "--"}
                </span>
              </button>
            </MetricTooltip>
          </div>
          <div className="mt-1 min-h-[20px]" aria-hidden="true">&nbsp;</div>
        </div>
        <div className="space-y-2">
          <div className="relative h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full overflow-hidden rounded-full"
              style={{
                width: `${animatedFillPercent}%`,
              }}
            >
              <div
                className="h-full w-full"
                style={{
                  width: `${10000 / Math.max(animatedFillPercent, 0.01)}%`,
                  background: thresholdGradient,
                }}
              />
            </div>
            <div
              className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_2px_rgba(15,23,42,0.85)]"
              style={{ left: `${thresholdPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>0.00</span>
            <span>{minimumRatio.toFixed(2)} required</span>
            <span>{displayMax.toFixed(2)}</span>
          </div>
          <div className="text-center">
            <div className={`text-xs font-medium ${ratio !== null && requiredRatio !== null ? (currentRatio >= minimumRatio ? "text-success" : "text-warning") : "text-muted-foreground"}`}>
              {formatRatioDelta(ratio, requiredRatio)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
