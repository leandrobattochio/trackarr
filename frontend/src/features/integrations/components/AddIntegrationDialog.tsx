import { useState, type FormEvent } from "react";
import { Plus, Check, ChevronLeft, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePlugins, useCreateIntegration } from "@/features/integrations/hooks";
import type { ApiPlugin } from "@/features/integrations/types";
import {
  type AddIntegrationErrors,
  getInitialFieldValues,
  normalizeFieldValue,
  normalizeIntegrationFieldValues,
  validateBaseUrlValue,
  validateFieldValue,
  validateIntegrationFields,
} from "@/features/integrations/components/add-integration-validation";
import { IntegrationConfigurationForm } from "@/features/integrations/components/shared/integration-dialog/IntegrationConfigurationForm";
import { createAddIntegrationFormStrategy } from "@/features/integrations/components/shared/integration-dialog/integrationFormStrategies";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { toast } from "sonner";

interface AddIntegrationDialogProps {
  addedPluginIds: string[];
}

export function AddIntegrationDialog({ addedPluginIds }: AddIntegrationDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<ApiPlugin | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<AddIntegrationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebounce(search, 250);

  const { data: plugins = [], isLoading: pluginsLoading } = usePlugins();
  const { mutate: createIntegration, isPending: isCreating } = useCreateIntegration();

  const filteredPlugins = debouncedSearch.trim()
    ? plugins.filter((p) =>
        p.displayName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.pluginId.toLowerCase().includes(debouncedSearch.toLowerCase()),
      )
    : plugins;

  function handleSelectPlugin(plugin: ApiPlugin) {
    setSelectedPlugin(plugin);
    setFieldValues(getInitialFieldValues(plugin));
    setFieldErrors({});
    setSubmitError(null);
  }

  function handleBack() {
    setSelectedPlugin(null);
    setFieldValues({});
    setFieldErrors({});
    setSubmitError(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    /* c8 ignore next */
    if (!selectedPlugin) return;

    const normalizedFieldValues = normalizeIntegrationFieldValues(selectedPlugin, fieldValues);
    const nextFieldErrors = validateIntegrationFields(selectedPlugin, normalizedFieldValues);
    setFieldValues(normalizedFieldValues);
    setFieldErrors(nextFieldErrors);
    setSubmitError(null);

    if (Object.keys(nextFieldErrors).length > 0) return;

    createIntegration(
      { pluginId: selectedPlugin.pluginId, payload: JSON.stringify(normalizedFieldValues) },
      {
        onSuccess: () => {
          toast.success(`${selectedPlugin.displayName} integration added`);
          setOpen(false);
          setSelectedPlugin(null);
          setFieldValues({});
          setFieldErrors({});
          setSubmitError(null);
        },
        onError: (err) => {
          setSubmitError(err.message);
          toast.error(err.message);
        },
      },
    );
  }

  function handleOpenChange(value: boolean) {
    setOpen(value);
    if (!value) {
      setSelectedPlugin(null);
      setFieldValues({});
      setFieldErrors({});
      setSubmitError(null);
      setSearch("");
    }
  }

  const formStrategy = selectedPlugin
    ? createAddIntegrationFormStrategy({
        plugin: selectedPlugin,
        fieldValues,
        fieldErrors,
        clearSubmitError: () => setSubmitError(null),
        setFieldValues,
        setFieldErrors,
        validateBaseUrlValue,
        validateFieldValue,
        normalizeFieldValue,
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Tracker
        </Button>
      </DialogTrigger>

      <DialogContent className="flex h-[min(720px,calc(100vh-2rem))] max-h-[calc(100vh-2rem)] flex-col overflow-hidden sm:max-w-2xl">
        {selectedPlugin === null ? (
          <>
            <DialogHeader>
              <DialogTitle>Add Tracker Integration</DialogTitle>
              <DialogDescription>Choose a private tracker to connect.</DialogDescription>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search trackers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {pluginsLoading && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!pluginsLoading && filteredPlugins.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No trackers match "{debouncedSearch}"
                  </p>
                )}

                {!pluginsLoading &&
                  filteredPlugins.map((plugin) => {
                    const isAdded = addedPluginIds.includes(plugin.pluginId);
                    return (
                      <button
                        key={plugin.pluginId}
                        disabled={isAdded}
                        onClick={() => handleSelectPlugin(plugin)}
                        className="flex w-full items-center gap-4 rounded-lg border border-border/50 bg-muted/30 p-4 text-left transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10 font-display text-sm font-bold text-primary">
                          {plugin.displayName.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="font-display text-sm font-semibold">{plugin.displayName}</p>
                          <p className="text-xs text-muted-foreground">{plugin.pluginId}</p>
                        </div>
                        {isAdded && <Check className="h-5 w-5 text-success" />}
                      </button>
                    );
                  })}
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleBack} className="h-7 w-7">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DialogTitle>{selectedPlugin.displayName}</DialogTitle>
              </div>
              <DialogDescription>Enter your credentials to connect this tracker.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col pt-2" noValidate>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                {submitError && (
                  <div
                    className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
                    role="alert"
                  >
                    {submitError}
                  </div>
                )}
                {formStrategy && (
                  <IntegrationConfigurationForm plugin={selectedPlugin} strategy={formStrategy} />
                )}
              </div>

              <div className="border-t border-border/50 pt-4">
                <Button type="submit" className="w-full" disabled={isCreating}>
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isCreating ? "Connecting..." : "Connect"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
