import { useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { useIntegrations } from "@/features/integrations/hooks";
import { getStatusLabel, type ApiIntegration } from "@/features/integrations/types";
import { useTestPlugin } from "@/features/plugins/hooks";
import { PluginTestResultPanel } from "@/features/plugins/components/PluginTestResultPanel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/shared/lib/utils";

export type PluginTestSource = { yaml: string } | { useOfficial: true };

interface PluginTestButtonProps {
  label: string;
  pluginId: string | null;
  pluginName: string;
  source: PluginTestSource;
  disabledReason?: string | null;
}

function getIntegrationLabel(integration: ApiIntegration) {
  return integration.url ?? `Integration ${integration.id.slice(0, 8)}`;
}

export function PluginTestButton({ label, pluginId, pluginName, source, disabledReason }: PluginTestButtonProps) {
  const integrationsQuery = useIntegrations();
  const testMutation = useTestPlugin();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const integrations = (integrationsQuery.data ?? []).filter((integration) => integration.pluginId === pluginId);
  const isOfficial = "useOfficial" in source;

  let unavailableReason = disabledReason ?? null;
  if (!unavailableReason) {
    if (!pluginId) {
      unavailableReason = "Set a pluginId in the YAML to test it.";
    } else if (integrationsQuery.isLoading) {
      unavailableReason = "Loading integrations…";
    } else if (integrationsQuery.error) {
      unavailableReason = `Could not load integrations: ${integrationsQuery.error.message}`;
    } else if (integrations.length === 0) {
      unavailableReason = `No integration uses ${pluginName}. Add one to test this plugin with its settings.`;
    }
  }

  const selected = integrations.find((integration) => integration.id === selectedId) ?? null;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      testMutation.reset();
      setSelectedId(integrations.length === 1 ? integrations[0].id : null);
    }
  }

  function handleSelect(integrationId: string) {
    setSelectedId(integrationId);
    testMutation.reset();
  }

  function handleRun() {
    if (selected) {
      testMutation.mutate({ integrationId: selected.id, ...source });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {unavailableReason && (
        <span data-testid="plugin-test-unavailable" className="text-xs text-muted-foreground">
          {unavailableReason}
        </span>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={Boolean(unavailableReason)}
        title={unavailableReason ?? undefined}
        onClick={() => handleOpenChange(true)}
      >
        <FlaskConical className="h-4 w-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {label} {pluginName}
            </DialogTitle>
            <DialogDescription>
              {isOfficial
                ? "Runs the official version, ignoring your override, with the settings of the integration you pick."
                : "Runs the YAML in the editor, saved or not, with the settings of the integration you pick."}{" "}
              No snapshot is saved and the integration is not changed.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Integration</legend>
            {integrations.map((integration) => (
              <label
                key={integration.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                  integration.id === selectedId ? "border-primary/60 bg-primary/10" : "border-border/60 hover:bg-muted/30",
                )}
              >
                <input
                  type="radio"
                  name="plugin-test-integration"
                  className="mt-1 accent-primary"
                  checked={integration.id === selectedId}
                  onChange={() => handleSelect(integration.id)}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{getIntegrationLabel(integration)}</span>
                  <span className="block text-xs text-muted-foreground">Last sync: {getStatusLabel(integration.lastSyncResult ?? "pending")}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {testMutation.error && (
            <p
              data-testid="plugin-test-request-error"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              Test failed to run: {testMutation.error.message}
            </p>
          )}

          {testMutation.data && <PluginTestResultPanel result={testMutation.data} />}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
            <Button type="button" disabled={!selected || testMutation.isPending} onClick={handleRun}>
              {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Run test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
