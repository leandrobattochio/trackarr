import { ArrowUpCircle } from "lucide-react";
import type { ApiAppReleaseReport } from "@/features/whats-new/types";
import { cn } from "@/shared/lib/utils";

export function AppUpdateNotice({ app, className }: { app: ApiAppReleaseReport | undefined; className?: string }) {
  const latest = app?.updateAvailable ? app.latestRelease : null;
  if (!latest) {
    return null;
  }

  const label = `trackarr v${latest.version} available`;
  return (
    <div data-testid="app-update-notice" className={cn("flex items-center gap-2 text-sm text-primary", className)}>
      <ArrowUpCircle className="h-4 w-4 shrink-0" />
      {latest.url ? (
        <a href={latest.url} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4 hover:text-primary/80">
          {label}
        </a>
      ) : (
        <span className="font-medium">{label}</span>
      )}
    </div>
  );
}
