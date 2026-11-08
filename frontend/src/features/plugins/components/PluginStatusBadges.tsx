import { AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getPluginBadges,
  getPluginNotices,
  type PluginBadgeKind,
  type PluginNotice,
} from "@/features/plugins/plugin-status";
import type { ApiPluginListItem } from "@/features/plugins/types";
import { cn } from "@/shared/lib/utils";

const BADGE_CLASSES: Record<PluginBadgeKind, string> = {
  official: "border-primary/40 bg-primary/10 text-primary",
  edited: "border-border/70 bg-secondary text-secondary-foreground",
  custom: "border-border/70 bg-muted/40 text-muted-foreground",
  outdated: "border-warning/40 bg-warning/10 text-warning",
  orphan: "border-warning/40 bg-warning/10 text-warning",
  deprecated: "border-warning/40 bg-warning/10 text-warning",
  incompatible: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function PluginStatusBadges({ plugin }: { plugin: ApiPluginListItem }) {
  return (
    <>
      {getPluginBadges(plugin).map((badge) => (
        <Badge
          key={badge.kind}
          variant="outline"
          data-testid={`plugin-badge-${badge.kind}`}
          className={cn("whitespace-nowrap rounded-full px-2 py-1", BADGE_CLASSES[badge.kind])}
        >
          {badge.label}
        </Badge>
      ))}
    </>
  );
}

function NoticeLine({ notice }: { notice: PluginNotice }) {
  const isInfo = notice.kind === "hiddenOfficial";
  const Icon = isInfo ? Info : AlertTriangle;
  return (
    <p
      data-testid={`plugin-notice-${notice.kind}`}
      className={cn(
        "flex items-start gap-1.5 text-xs",
        isInfo ? "text-muted-foreground" : notice.kind === "incompatible" ? "text-destructive" : "text-warning",
      )}
    >
      <Icon className="mt-0.5 h-3 w-3 shrink-0" />
      <span>{notice.message}</span>
    </p>
  );
}

export function PluginStatusNotices({ plugin, className }: { plugin: ApiPluginListItem; className?: string }) {
  const notices = getPluginNotices(plugin);
  if (notices.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-1", className)}>
      {notices.map((notice) => (
        <NoticeLine key={notice.kind} notice={notice} />
      ))}
    </div>
  );
}
