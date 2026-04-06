import { startTransition, useEffect, useMemo, useState, useTransition } from "react";
import Editor from "@monaco-editor/react";
import { AlertTriangle, FolderOpen, Loader2, Plus, Save } from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePageTitle } from "@/shared/hooks/use-page-title";
import {
  useCreatePluginDefinition,
  usePluginCatalog,
  usePluginDefinition,
  useUpdatePluginDefinition,
} from "@/features/plugins/hooks";
import { NEW_PLUGIN_TEMPLATE } from "@/features/plugins/plugin-template";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";

const EDITOR_HEIGHT = "70vh";

export function tryGetPluginId(yaml: string) {
  const match = yaml.match(/^\s*pluginId\s*:\s*["']?([A-Za-z0-9-]+)["']?\s*$/m);
  return match?.[1] ?? null;
}

export default function ManagePluginsPage() {
  usePageTitle("TrackArr | Manage Plugins");

  const { data: plugins = [], isLoading, error } = usePluginCatalog();
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [baselineValue, setBaselineValue] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSwitchingEditorState, startEditorTransition] = useTransition();

  const createMutation = useCreatePluginDefinition();
  const updateMutation = useUpdatePluginDefinition();

  useEffect(() => {
    if (plugins.length === 0 || isCreatingNew) {
      return;
    }

    setSelectedPluginId((current) => current ?? plugins[0].pluginId);
  }, [plugins, isCreatingNew]);

  const selectedPlugin = useMemo(
    () => plugins.find((plugin) => plugin.pluginId === selectedPluginId) ?? null,
    [plugins, selectedPluginId],
  );

  const definitionQuery = usePluginDefinition(selectedPluginId ?? "", Boolean(selectedPluginId) && !isCreatingNew);

  useEffect(() => {
    if (!definitionQuery.data || isCreatingNew) {
      return;
    }

    setEditorValue(definitionQuery.data);
    setBaselineValue(definitionQuery.data);
    setSubmitError(null);
  }, [definitionQuery.data, isCreatingNew]);

  function handleSelectPlugin(pluginId: string) {
    startEditorTransition(() => {
      setIsCreatingNew(false);
      setSelectedPluginId(pluginId);
      setEditorValue("");
      setBaselineValue("");
      setSubmitError(null);
    });
  }

  function handleCreatePlugin() {
    startEditorTransition(() => {
      setIsCreatingNew(true);
      setSelectedPluginId(null);
      setEditorValue(NEW_PLUGIN_TEMPLATE);
      setBaselineValue(NEW_PLUGIN_TEMPLATE);
      setSubmitError(null);
    });
  }

  function handleEditorChange(value: string) {
    setEditorValue(value);

    if (submitError) {
      startTransition(() => {
        setSubmitError(null);
      });
    }
  }

  function handleSave() {
    if (isCreatingNew) {
      createMutation.mutate(editorValue, {
        onSuccess: () => {
          const pluginId = tryGetPluginId(editorValue);
          setBaselineValue(editorValue);
          setIsCreatingNew(false);
          if (pluginId) {
            setSelectedPluginId(pluginId);
          }
          toast.success("Plugin created.");
        },
        onError: (mutationError) => {
          setSubmitError(mutationError.message);
          toast.error(`Create failed: ${mutationError.message}`);
        },
      });
      return;
    }

    if (!selectedPluginId) {
      return;
    }

    updateMutation.mutate(
      { pluginId: selectedPluginId, yaml: editorValue },
      {
        onSuccess: () => {
          setBaselineValue(editorValue);
          setSubmitError(null);
          toast.success(`${selectedPlugin?.displayName ?? selectedPluginId} saved.`);
        },
        onError: (mutationError) => {
          setSubmitError(mutationError.message);
          toast.error(`Save failed: ${mutationError.message}`);
        },
      },
    );
  }

  const selectedPluginError = !isCreatingNew ? selectedPlugin?.definitionError ?? null : null;
  const selectedFieldCount = selectedPlugin
    ? selectedPlugin.fields.length + selectedPlugin.customFields.length
    : 0;
  const isDirty = editorValue !== baselineValue;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isEditorBusy = definitionQuery.isLoading || isSaving || isSwitchingEditorState;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Manage Plugins</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Plugin templates are loaded from disk. Existing definitions are editable and new plugins are created as physical YAML files.
            </p>
          </div>
          <Button onClick={handleCreatePlugin} className="xl:self-start">
            <Plus className="h-4 w-4" />
            New Plugin
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="border-border/50 bg-card/95">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Plugin Catalog</CardTitle>
                  <CardDescription>Disk-backed YAML definitions.</CardDescription>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Loaded</p>
                  <p className="font-display text-lg font-semibold">{plugins.length}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading && (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-xl" />
                  ))}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  Failed to load plugins: {error.message}
                </div>
              )}

              {!isLoading && !error && (
                <ScrollArea className="h-[70vh] pr-3">
                  <div className="space-y-3">
                    {plugins.map((plugin) => {
                      const isActive = !isCreatingNew && selectedPluginId === plugin.pluginId;
                      const needsFixing = !plugin.definitionValid;

                      return (
                        <button
                          key={plugin.pluginId}
                          type="button"
                          onClick={() => handleSelectPlugin(plugin.pluginId)}
                          className={cn(
                            "w-full rounded-xl border p-4 text-left transition-colors",
                            "hover:border-primary/50 hover:bg-muted/30",
                            isActive
                              ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                              : "border-border/60 bg-muted/10",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="truncate font-display text-sm font-semibold">{plugin.displayName}</p>
                              <p className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                {plugin.pluginId}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {needsFixing && (
                                <Badge variant="destructive" className="gap-1 rounded-full px-2 py-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Needs Fixing
                                </Badge>
                              )}
                              <Badge variant="outline" className="gap-1 rounded-full px-2 py-1 border-border/70 bg-muted/40 text-muted-foreground">
                                <FolderOpen className="h-3 w-3" />
                                Disk
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-end text-xs text-muted-foreground">
                            <span>{plugin.definitionValid ? `${plugin.fields.length + plugin.customFields.length} fields` : "Definition invalid"}</span>
                          </div>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={handleCreatePlugin}
                      className={cn(
                        "w-full rounded-xl border border-dashed p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5",
                        isCreatingNew ? "border-primary/60 bg-primary/10" : "border-border/60 bg-transparent",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Plus className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-display text-sm font-semibold">New Plugin Draft</p>
                          <p className="text-sm text-muted-foreground">
                            Start from a commented YAML template and save it directly as a new disk plugin.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/95">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-lg">
                      {isCreatingNew ? "New Plugin Draft" : selectedPlugin?.displayName ?? "Plugin Definition"}
                    </CardTitle>
                    {!isCreatingNew && selectedPlugin && (
                      <Badge variant="outline" className="gap-1 rounded-full px-2 py-1 border-border/70 bg-muted/40 text-muted-foreground">
                        <FolderOpen className="h-3 w-3" />
                        Disk
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {isCreatingNew
                      ? "Start from the documented template and adjust metadata, fields, steps, mapping, and dashboard metrics."
                      : selectedPlugin
                        ? `${selectedPlugin.pluginId} · editable`
                        : "Select a plugin definition from the catalog to inspect it."}
                  </CardDescription>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:w-auto">
                  <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Fields</p>
                    <p className="mt-1 font-display text-lg font-semibold">{isCreatingNew ? "Template" : selectedFieldCount}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Mode</p>
                    <p className="mt-1 font-display text-lg font-semibold">{isCreatingNew ? "Create" : "Edit"}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {definitionQuery.isLoading && !isCreatingNew && (
                <div className="flex h-[70vh] items-center justify-center rounded-xl border border-border/60 bg-muted/10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {definitionQuery.error && !isCreatingNew && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  Failed to load plugin YAML: {definitionQuery.error.message}
                </div>
              )}

              {selectedPluginError && (
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Plugin definition needs fixing</p>
                      <p>{selectedPluginError}</p>
                    </div>
                  </div>
                </div>
              )}

              {submitError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  {submitError}
                </div>
              )}

              {(!definitionQuery.isLoading || isCreatingNew) && (!selectedPluginId || editorValue || isCreatingNew) && (
                <div className="overflow-hidden rounded-xl border border-border/70 bg-[#0b1220] shadow-inner">
                  <Editor
                    height={EDITOR_HEIGHT}
                    defaultLanguage="yaml"
                    language="yaml"
                    theme="vs-dark"
                    value={editorValue}
                    onChange={(value) => handleEditorChange(value ?? "")}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: "JetBrains Mono, monospace",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      automaticLayout: true,
                      tabSize: 2,
                      formatOnPaste: true,
                      formatOnType: true,
                      quickSuggestions: true,
                      suggestOnTriggerCharacters: true,
                      padding: { top: 16, bottom: 16 },
                      readOnly: isEditorBusy,
                    }}
                  />
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-border/60 pt-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-sm text-muted-foreground">
                  {isCreatingNew
                    ? "Create writes a new physical YAML file into the plugin directory."
                    : "Save writes the current YAML back to the physical plugin file on disk."}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={handleSave} disabled={isEditorBusy || !editorValue.trim() || (!isCreatingNew && !isDirty)}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : isCreatingNew ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    {isCreatingNew ? "Create Plugin" : "Save"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
