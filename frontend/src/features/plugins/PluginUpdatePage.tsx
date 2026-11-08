import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePageTitle } from "@/shared/hooks/use-page-title";
import { useDeletePluginOverride, usePluginCatalog, usePluginDiff } from "@/features/plugins/hooks";
import { getOutdatedMessage, getOutdatedToneClass, getPluginEditorPath, isOutdatedOverride } from "@/features/plugins/plugin-status";
import { PluginStatusBadges } from "@/features/plugins/components/PluginStatusBadges";
import { PluginDiffPanel } from "@/features/plugins/components/PluginDiffPanel";
import { PluginTestButton } from "@/features/plugins/components/PluginTestButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/shared/lib/utils";

function Message({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "error" }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 text-sm",
        tone === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border/60 bg-muted/10 text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}

export default function PluginUpdatePage() {
  const { pluginId = "" } = useParams();
  const navigate = useNavigate();
  const { data: plugins = [], isLoading: isCatalogLoading, error: catalogError } = usePluginCatalog();
  const plugin = plugins.find((item) => item.pluginId === pluginId) ?? null;
  const isOutdated = plugin !== null && isOutdatedOverride(plugin);
  const diffQuery = usePluginDiff(pluginId, isOutdated);
  const deleteOverride = useDeletePluginOverride();
  const displayName = plugin?.displayName ?? pluginId;

  usePageTitle(`TrackArr | Review ${displayName} update`);

  const editorPath = getPluginEditorPath(pluginId);

  function handleUseOfficial() {
    deleteOverride.mutate(pluginId, {
      onSuccess: () => {
        toast.success(`${displayName} now uses the official version.`);
        navigate(editorPath);
      },
      onError: (error) => {
        toast.error(`Use official failed: ${error.message}`);
      },
    });
  }

  function renderBody() {
    if (isCatalogLoading) {
      return (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (catalogError) {
      return <Message tone="error">Failed to load plugins: {catalogError.message}</Message>;
    }

    if (!plugin || !isOutdated) {
      return (
        <Message>
          {plugin ? `${displayName} has no outdated override.` : `Plugin ${pluginId} was not found.`}{" "}
          <Link to={editorPath} className="font-medium text-foreground underline underline-offset-4">
            Back to plugins
          </Link>
        </Message>
      );
    }

    const diff = diffQuery.data;
    const isBusy = deleteOverride.isPending;

    return (
      <div className="space-y-6">
        <div
          data-testid="outdated-override-warning"
          data-highlighted={String(plugin.lastSyncFailed)}
          className={cn(
            "space-y-3 rounded-xl border p-4 text-sm",
            getOutdatedToneClass(plugin.lastSyncFailed),
          )}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Your override is outdated</p>
              <p>{getOutdatedMessage(plugin)} Your copy keeps running until you choose.</p>
              {plugin.lastSyncFailed && (
                <p>
                  The last sync of an integration using your copy failed. Test the official version with that
                  integration's settings before you decide.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={isBusy}>
                  {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Use official
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Use the official {displayName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your override is deleted with no backup, and every integration of {displayName} switches to the
                    official version right away. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleUseOfficial}
                  >
                    Delete my override
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" disabled={isBusy} onClick={() => navigate(editorPath)}>
              Keep mine
            </Button>
            {plugin.lastSyncFailed && (
              <PluginTestButton
                label="Test official"
                pluginId={pluginId}
                pluginName={displayName}
                source={{ useOfficial: true }}
              />
            )}
          </div>
        </div>

        {diffQuery.isLoading && (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {diffQuery.error && <Message tone="error">Failed to load the plugin diff: {diffQuery.error.message}</Message>}

        {diff && (
          <>
            <section data-testid="plugin-changelog" className="space-y-2">
              <h2 className="font-display text-base font-semibold">
                Official changes since {diff.baseVersion ? `v${diff.baseVersion}` : "your base"}
              </h2>
              {diff.changelog.length === 0 ? (
                <p className="text-sm text-muted-foreground">The official plugin lists no changelog entries for these versions.</p>
              ) : (
                <ul className="space-y-2">
                  {diff.changelog.map((entry) => (
                    <li key={entry.version} className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm">
                      <p className="font-medium">
                        v{entry.version} <span className="text-xs font-normal text-muted-foreground">{entry.date}</span>
                      </p>
                      <p className="whitespace-pre-line text-muted-foreground">{entry.notes}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="grid gap-6 xl:grid-cols-2">
              <PluginDiffPanel
                testId="diff-yours"
                title="What you changed"
                description={`Official v${diff.baseVersion ?? "?"} against your override.`}
                original={diff.base}
                modified={diff.yours}
              />
              <PluginDiffPanel
                testId="diff-upstream"
                title="What changed upstream"
                description={`Official v${diff.baseVersion ?? "?"} against official v${diff.latestOfficialVersion ?? "?"}.`}
                original={diff.base}
                modified={diff.latestOfficial}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <DashboardLayout>
      <Card className="border-border/50 bg-card/95">
        <CardHeader className="space-y-3">
          <Link to={editorPath} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Plugins
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">Review {displayName} update</CardTitle>
            {plugin && <PluginStatusBadges plugin={plugin} />}
          </div>
          <CardDescription>Compare your override with the new official version, then decide which one to run.</CardDescription>
        </CardHeader>
        <CardContent>{renderBody()}</CardContent>
      </Card>
    </DashboardLayout>
  );
}
