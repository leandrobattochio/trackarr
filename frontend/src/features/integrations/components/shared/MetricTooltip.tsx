import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MetricTooltipProps {
  label: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
}

export function MetricTooltip({
  label,
  eyebrow,
  description,
  children,
}: MetricTooltipProps) {
  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[220px] rounded-xl border-border/70 bg-[linear-gradient(180deg,hsl(var(--popover))_0%,hsl(var(--card))_100%)] px-4 py-3 shadow-[0_18px_60px_hsl(var(--background)/0.55)]"
      >
        <div className="space-y-1">
          <p className="font-display text-[11px] uppercase tracking-[0.28em] text-muted-foreground">{eyebrow}</p>
          <p className="font-display text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
