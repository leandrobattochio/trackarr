import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePluginCatalog } from "@/features/plugins/hooks";
import { AppUpdateNotice } from "@/features/whats-new/components/AppUpdateNotice";
import type { ApiAppReleaseReport, ApiPluginUpdate, ApiWhatsNew } from "@/features/whats-new/types";
import { formatDate, groupPluginUpdates } from "@/features/whats-new/whats-new";

interface WhatsNewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: ApiWhatsNew | undefined;
  isLoading: boolean;
  error: Error | null;
}

function Notes({ text }: { text: string }) {
  return text.trim() ? (
    <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{text.trim()}</p>
  ) : (
    <p className="text-sm text-muted-foreground">No release notes.</p>
  );
}

function AppSection({ app }: { app: ApiAppReleaseReport }) {
  if (app.status === "unavailable") {
    return (
      <div data-testid="whats-new-app-unavailable" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
        <p className="font-medium text-foreground">Could not load trackarr release notes.</p>
        {app.error && <p className="mt-1 text-muted-foreground">{app.error}</p>}
      </div>
    );
  }

  if (app.releases.length === 0) {
    return <p className="text-sm text-muted-foreground">No new trackarr release.</p>;
  }

  return (
    <div className="space-y-4">
      {app.releases.map((release) => (
        <article key={release.version} data-testid={`whats-new-app-${release.version}`} className="space-y-1">
          <h4 className="flex flex-wrap items-baseline gap-2 font-semibold text-foreground">
            v{release.version}
            {release.publishedAt && <span className="text-xs font-normal text-muted-foreground">{formatDate(release.publishedAt)}</span>}
          </h4>
          <Notes text={release.notes} />
        </article>
      ))}
    </div>
  );
}

function PluginsSection({ updates }: { updates: ApiPluginUpdate[] }) {
  const { data: plugins = [] } = usePluginCatalog();
  const groups = groupPluginUpdates(updates);

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">No new plugin updates.</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const name = plugins.find((plugin) => plugin.pluginId === group.pluginId)?.displayName ?? group.pluginId;
        return (
          <article key={group.pluginId} data-testid={`whats-new-plugin-${group.pluginId}`} className="space-y-2">
            <h4 className="flex flex-wrap items-baseline gap-2 font-semibold text-foreground">
              {name}
              <span className="text-xs font-normal text-muted-foreground">
                {group.fromVersion ? `v${group.fromVersion} → v${group.toVersion}` : `installed v${group.toVersion}`}
              </span>
            </h4>
            {group.changelog.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changelog for this version.</p>
            ) : (
              <ul className="space-y-2 border-l border-border pl-3">
                {group.changelog.map((entry) => (
                  <li key={entry.version}>
                    <p className="text-sm font-medium text-foreground">
                      v{entry.version}
                      {entry.date && <span className="ml-2 text-xs font-normal text-muted-foreground">{formatDate(entry.date)}</span>}
                    </p>
                    <Notes text={entry.notes} />
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function WhatsNewDialog({ open, onOpenChange, report, isLoading, error }: WhatsNewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="whats-new-dialog" className="flex max-h-[85vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>What's New</DialogTitle>
          <DialogDescription>
            {report?.lastReadAt ? `Changes since you last looked on ${formatDate(report.lastReadAt)}.` : "Changes in trackarr and in your plugins."}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 min-h-0 flex-1 space-y-6 overflow-y-auto px-6">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && !report && (
            <p className="text-sm text-destructive">Could not load What's New{error ? `: ${error.message}` : "."}</p>
          )}
          {report && (
            <>
              <AppUpdateNotice app={report.app} className="rounded-lg border border-primary/40 bg-primary/10 p-3" />
              <section data-testid="whats-new-app-section" className="space-y-3">
                <h3 className="font-display text-lg font-semibold text-foreground">trackarr</h3>
                <AppSection app={report.app} />
              </section>
              <section data-testid="whats-new-plugins-section" className="space-y-3">
                <h3 className="font-display text-lg font-semibold text-foreground">Plugins</h3>
                <PluginsSection updates={report.pluginUpdates} />
              </section>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
