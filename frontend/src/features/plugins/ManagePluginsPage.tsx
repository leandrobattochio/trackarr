import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import Editor from "@monaco-editor/react";
import { load } from "js-yaml";
import { Database, FolderOpen, Loader2, Plus, Save, Trash2 } from "lucide-react";
import type * as Monaco from "monaco-editor";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePageTitle } from "@/shared/hooks/use-page-title";
import {
  useCreatePluginDefinition,
  useDeletePluginDefinition,
  usePluginCatalog,
  usePluginDefinition,
  useUpdatePluginDefinition,
} from "@/features/plugins/hooks";
import { NEW_PLUGIN_TEMPLATE } from "@/features/plugins/plugin-template";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import type { ApiPluginListItem } from "@/features/plugins/types";
import {
  configurePluginYamlMonaco,
  installPluginYamlDiagnostics,
  PLUGIN_EDITOR_MODEL_URI,
  syncPluginYamlDiagnostics,
  validatePluginYamlDocument,
} from "@/features/plugins/editor/plugin-language";

const EDITOR_HEIGHT = "70vh";

function getSourceMeta(source: ApiPluginListItem["source"]) {
  if (source === "database") {
    return {
      label: "Database",
      icon: Database,
      className: "border-primary/40 bg-primary/10 text-primary",
    };
  }

  return {
    label: "Disk",
    icon: FolderOpen,
    className: "border-border/70 bg-muted/40 text-muted-foreground",
  };
}

export default function ManagePluginsPage() {
  usePageTitle("TrackArr | Manage Plugins");

  const { data: plugins = [], isLoading, error } = usePluginCatalog();
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [baselineValue, setBaselineValue] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const diagnosticsCleanupRef = useRef<(() => void) | null>(null);
  const [isSwitchingEditorState, startEditorTransition] = useTransition();

  const createMutation = useCreatePluginDefinition();
  const updateMutation = useUpdatePluginDefinition();
  const deleteMutation = useDeletePluginDefinition();

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

  const liveValidation = useMemo(
    () => validatePluginYamlDocument(editorValue, {
      expectedPluginId: isCreatingNew ? null : selectedPluginId,
    }),
    [editorValue, isCreatingNew, selectedPluginId],
  );

  const liveValidationError = liveValidation.markers[0]?.message ?? null;
  const activeError = submitError ?? liveValidationError;

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

  function validateYaml(yaml: string): boolean {
    if (liveValidation.markers.length > 0) {
      return false;
    }

    try {
      load(yaml);
      setSubmitError(null);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid YAML syntax.";
      setSubmitError(message);
      return false;
    }
  }

  function handleEditorChange(value: string) {
    setEditorValue(value);

    if (submitError) {
      startTransition(() => {
        setSubmitError(null);
      });
    }
  }

  async function handleSave() {
    if (!validateYaml(editorValue)) {
      toast.error("Fix the YAML syntax before saving.");
      return;
    }

    if (isCreatingNew) {
      createMutation.mutate(editorValue, {
        onSuccess: async () => {
          const parsed = load(editorValue) as { pluginId?: string } | null;
          const pluginId = parsed?.pluginId?.trim();

          setBaselineValue(editorValue);
          setIsCreatingNew(false);
          if (pluginId) {
            setSelectedPluginId(pluginId);
          }

          toast.success("Plugin created.");
        },
        onError: (mutationError) => {
          setSubmitError(mutationError.message);
          toast.error(`Save failed: ${mutationError.message}`);
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

  function handleDelete() {
    if (!selectedPluginId) {
      return;
    }

    deleteMutation.mutate(selectedPluginId, {
      onSuccess: () => {
        toast.success(`${selectedPlugin?.displayName ?? selectedPluginId} deleted.`);
        setSubmitError(null);
        setEditorValue("");
        setBaselineValue("");
        setSelectedPluginId(null);
        setIsCreatingNew(false);
      },
      onError: (mutationError) => {
        setSubmitError(mutationError.message);
        toast.error(`Delete failed: ${mutationError.message}`);
      },
    });
  }

  function handleEditorWillMount(monaco: typeof Monaco) {
    monacoRef.current = monaco;
    configurePluginYamlMonaco(monaco);
  }

  function handleEditorMount(editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;

    diagnosticsCleanupRef.current?.();
    const model = editor.getModel();
    if (!model) {
      return;
    }

    diagnosticsCleanupRef.current = installPluginYamlDiagnostics(monaco, model, () => ({
      expectedPluginId: isCreatingNew ? null : selectedPluginId,
    }));
  }

  const getValidationOptions = useEffectEvent(() => ({
    expectedPluginId: isCreatingNew ? null : selectedPluginId,
  }));

  const refreshEditorDiagnostics = useEffectEvent(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();

    if (!editor || !monaco || !model) {
      return;
    }

    syncPluginYamlDiagnostics(monaco, model, getValidationOptions);
  });

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const model = editor.getModel();
    if (!model) {
      return;
    }

    const monaco = monacoRef.current;
    if (!monaco) {
      return;
    }

    diagnosticsCleanupRef.current?.();
    diagnosticsCleanupRef.current = installPluginYamlDiagnostics(monaco, model, () => ({
      expectedPluginId: isCreatingNew ? null : selectedPluginId,
    }));

    return () => {
      diagnosticsCleanupRef.current?.();
      diagnosticsCleanupRef.current = null;
    };
  }, [isCreatingNew, selectedPluginId]);

  useEffect(() => {
    refreshEditorDiagnostics();
  }, [refreshEditorDiagnostics, isCreatingNew, selectedPluginId]);

  const activeSourceMeta = selectedPlugin ? getSourceMeta(selectedPlugin.source) : null;
  const selectedFieldCount = selectedPlugin?.fields.length ?? 0;
  const isDirty = editorValue !== baselineValue;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const canDelete = Boolean(selectedPlugin && selectedPlugin.source === "database" && !isCreatingNew);
  const isEditorBusy = definitionQuery.isLoading || isSaving || isDeleting || isSwitchingEditorState;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Manage Plugins</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Review built-in YAML definitions, inspect database overrides, and start new plugin drafts from a starter schema.
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
                  <CardDescription>Available disk and database definitions.</CardDescription>
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
                      const sourceMeta = getSourceMeta(plugin.source);
                      const isActive = !isCreatingNew && selectedPluginId === plugin.pluginId;

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
                            <Badge variant="outline" className={cn("gap-1 rounded-full px-2 py-1", sourceMeta.className)}>
                              <sourceMeta.icon className="h-3 w-3" />
                              {sourceMeta.label}
                            </Badge>
                          </div>
                          <div className="mt-4 flex items-center justify-end text-xs text-muted-foreground">
                            <span>{plugin.fields.length} fields</span>
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
                            Open a starter YAML template without touching an existing definition.
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
                    {activeSourceMeta && !isCreatingNew && (
                      <Badge variant="outline" className={cn("gap-1 rounded-full px-2 py-1", activeSourceMeta.className)}>
                        <activeSourceMeta.icon className="h-3 w-3" />
                        {activeSourceMeta.label}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {isCreatingNew
                      ? "Start from the baseline YAML schema and adjust metadata, fields, steps, and mappings."
                      : selectedPlugin
                        ? selectedPlugin.pluginId
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
                    <p className="mt-1 font-display text-lg font-semibold">{isCreatingNew ? "Draft" : "Edit"}</p>
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

              {!definitionQuery.isLoading && (!selectedPluginId || editorValue) && (
                <div className="overflow-hidden rounded-xl border border-border/70 bg-[#0b1220] shadow-inner">
                  <Editor
                    beforeMount={handleEditorWillMount}
                    onMount={handleEditorMount}
                    height={EDITOR_HEIGHT}
                    path={PLUGIN_EDITOR_MODEL_URI}
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
                  {activeError
                    ? `Validation error: ${activeError}`
                    : canDelete
                      ? "Database-backed plugins can be deleted here. Disk plugins can only be overridden by saving edits."
                      : "Save applies YAML changes immediately. Disk plugins become database overrides after their first save."}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="text-destructive hover:text-destructive" disabled={isEditorBusy}>
                          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete plugin definition?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the database definition for {selectedPlugin?.displayName ?? selectedPluginId}. If a disk version exists, it will become active again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDelete}
                            disabled={isDeleting}
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Button onClick={handleSave} disabled={isEditorBusy || !editorValue.trim() || Boolean(liveValidationError) || (!isCreatingNew && !isDirty)}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isCreatingNew ? "Create Plugin" : "Save Changes"}
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
